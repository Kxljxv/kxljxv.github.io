# graph_layout.R
# Dieses Skript berechnet die 1D-Positionen von Personen basierend auf ihren 
# gemeinsamen Amendments (Initiatoren/Supporter) und visualisiert das Ergebnis.

# Benötigte Pakete prüfen und ggf. installieren
required_packages <- c("vctrs", "RSQLite", "jsonlite", "ggplot2", "dplyr", "tidyr", "purrr")
new_packages <- required_packages[!(required_packages %in% installed.packages()[,"Package"])]
if(length(new_packages)) install.packages(new_packages)

suppressPackageStartupMessages({
  library(RSQLite)
  library(jsonlite)
  library(ggplot2)
  library(dplyr)
  library(tidyr)
  library(purrr)
})

cat("Lade Daten aus final_data.db...\n")

# 1. Daten laden
# Festlegen des Basis-Verzeichnisses
base_dir <- "c:/Users/kolja/Desktop/ldk-26-1-schnell"
sub_dir <- "one-dimensional"

if (dir.exists(base_dir)) {
  setwd(base_dir)
}

db_path <- file.path(sub_dir, "final_data.db")
if (!file.exists(db_path)) {
  stop(paste("Datenbank nicht gefunden:", db_path, "\nAktuelles Verzeichnis:", getwd()))
}

con <- dbConnect(SQLite(), db_path)

# Tabellenstruktur prüfen und Spalten hinzufügen falls nötig
cols_persons <- dbGetQuery(con, "PRAGMA table_info(persons)")
if (!("pos_1d" %in% cols_persons$name)) {
  dbExecute(con, "ALTER TABLE persons ADD COLUMN pos_1d REAL")
}

cols_amendments <- dbGetQuery(con, "PRAGMA table_info(amendments)")
if (!("pos_1d" %in% cols_amendments$name)) {
  dbExecute(con, "ALTER TABLE amendments ADD COLUMN pos_1d REAL")
}

amendments <- dbGetQuery(con, "SELECT id, title, initiators, supporters, status_id FROM amendments")
persons_db <- dbGetQuery(con, "SELECT id, display_name FROM persons")
dbDisconnect(con)

# 2. Daten vorverarbeiten
cat("Verarbeite Beziehungen (Initiatoren & Supporter)...\n")

person_list <- persons_db %>% rename(name = display_name)
# Mapping von Name auf ID für schnellen Lookup
person_name_to_id <- person_list$id
names(person_name_to_id) <- person_list$name

# Funktion zum Parsen der JSON-Felder
parse_participants <- function(json_str) {
  if (is.na(json_str) || json_str == "[]" || json_str == "") return(NULL)
  tryCatch({
    fromJSON(json_str)
  }, error = function(e) NULL)
}

links <- list()

for (i in 1:nrow(amendments)) {
  a <- amendments[i, ]
  
  # Initiatoren (Gewicht 3.0)
  inits <- parse_participants(a$initiators)
  if (!is.null(inits) && "name" %in% names(inits)) {
    for (p_name in inits$name) {
      links[[length(links) + 1]] <- data.frame(
        person_name = p_name,
        amendment_id = a$id,
        weight = 3.0,
        stringsAsFactors = FALSE
      )
    }
  }
  
  # Supporter (Gewicht 1.5 bis 1.0 linear abnehmend)
  supps <- parse_participants(a$supporters)
  if (!is.null(supps) && "name" %in% names(supps)) {
    n_supps <- nrow(supps)
    for (j in 1:n_supps) {
      p_name <- supps$name[j]
      # Gewichtung: erste in der Liste 1.5, letzte 1.0
      weight <- if (n_supps > 1) 1.5 - 0.5 * ((j - 1) / (n_supps - 1)) else 1.5
      links[[length(links) + 1]] <- data.frame(
        person_name = p_name,
        amendment_id = a$id,
        weight = weight,
        stringsAsFactors = FALSE
      )
    }
  }
}

if (length(links) == 0) {
  stop("Keine Beziehungen zwischen Personen und Amendments gefunden.")
}

links_df <- bind_rows(links)

# Nur Personen behalten, die in der Personen-Tabelle existieren
links_df <- links_df %>% 
  filter(person_name %in% names(person_name_to_id)) %>%
  mutate(person_id = person_name_to_id[person_name])

# Eindeutige Personen und Amendments für die Matrix-Berechnung
unique_person_ids <- unique(links_df$person_id)
person_data <- data.frame(
  id = unique_person_ids,
  x = runif(length(unique_person_ids), -1, 1),
  stringsAsFactors = FALSE
) %>% left_join(person_list, by = "id") %>%
  mutate(idx = seq_along(id))

unique_amendment_ids <- unique(links_df$amendment_id)
amendment_data <- data.frame(
  id = unique_amendment_ids,
  x = 0,
  idx = seq_along(unique_amendment_ids),
  stringsAsFactors = FALSE
)

# Indizes in den Link-Dataframe mappen für schnellere Loops
links_df <- links_df %>%
  left_join(person_data %>% select(id, person_idx = idx), by = c("person_id" = "id")) %>%
  left_join(amendment_data %>% select(id, amendment_idx = idx), by = c("amendment_id" = "id"))

# 3. Iterations-Logik (Baryzentrisches Layout mit Schwerkraft)
cat("Starte Berechnungen (Baryzentrisches Layout)...\n")

run_layout <- function(p_data, a_data, l_df, iterations = 100) {
  px <- p_data$x
  ax <- a_data$x
  
  # Vorberechnen der Gesamtgewichte
  a_total_w <- l_df %>% group_by(amendment_idx) %>% summarize(tw = sum(weight)) %>% arrange(amendment_idx) %>% pull(tw)
  p_total_w <- l_df %>% group_by(person_idx) %>% summarize(tw = sum(weight)) %>% arrange(person_idx) %>% pull(tw)
  
  for (it in 1:iterations) {
    # 1. Amendment-Positionen = gewichteter Mittelpunkt der Teilnehmer
    a_sums <- l_df %>%
      mutate(weighted_x = px[person_idx] * weight) %>%
      group_by(amendment_idx) %>%
      summarize(s = sum(weighted_x)) %>%
      arrange(amendment_idx) %>%
      pull(s)
    
    ax <- a_sums / a_total_w
    
    # 2. Personen-Positionen = gewichteter Mittelpunkt der "Rest-Zentren" ihrer Amendments
    # (Eliminiert die Selbst-Beeinflussung)
    p_sums <- l_df %>%
      mutate(
        a_tw = a_total_w[amendment_idx],
        a_x = ax[amendment_idx],
        rest_weight = a_tw - weight,
        rest_x = ifelse(rest_weight > 0, (a_x * a_tw - px[person_idx] * weight) / rest_weight, a_x),
        weighted_rest_x = rest_x * weight
      ) %>%
      group_by(person_idx) %>%
      summarize(s = sum(weighted_rest_x)) %>%
      arrange(person_idx) %>%
      pull(s)
    
    bary_x <- p_sums / p_total_w
    
    # Stückweise Gravitation Richtung Zentrum (0)
    u <- abs(0.12 * bary_x)
    gravity <- case_when(
      u > 1 ~ 1,
      u < 0.5 ~ 4 * u^3,
      TRUE ~ 1 - ((-2 * u + 2)^3) / 2
    )
    
    px <- bary_x * (1 - gravity)
    
    # Quantil-Normalisierung (10% -> -1, 90% -> 1)
    p10 <- quantile(px, 0.1)
    p90 <- quantile(px, 0.9)
    if (p90 != p10) {
      px <- ((px - p10) / (p90 - p10)) * 2 - 1
    }
    
    if (it %% 20 == 0) cat(sprintf("Iteration %d/%d abgeschlossen...\n", it, iterations))
  }
  
  # Finale Amendment-Positionen basierend auf finalen Personen-Positionen berechnen
  a_sums_final <- l_df %>%
    mutate(weighted_x = px[person_idx] * weight) %>%
    group_by(amendment_idx) %>%
    summarize(s = sum(weighted_x)) %>%
    arrange(amendment_idx) %>%
    pull(s)
  ax <- a_sums_final / a_total_w
  
  p_data$x <- px
  a_data$x <- ax
  return(list(p = p_data, a = a_data))
}

results <- run_layout(person_data, amendment_data, links_df, iterations = 100)
person_final <- results$p
amendment_final <- results$a %>%
  left_join(amendments %>% select(id, title, status_id), by = "id")

# 4. Visualisierung
cat("Erstelle Visualisierung...\n")

plot <- ggplot() +
  # Dichtekurve (KDE) für Personen
  geom_density(data = person_final, aes(x = x), fill = "#4a90e2", alpha = 0.1, color = "#4a90e2", linewidth = 0.5) +
  # Nulllinie
  geom_vline(xintercept = 0, linetype = "dotted", color = "gray70") +
  # Personen als Punkte (oben)
  geom_point(data = person_final, aes(x = x, y = 0.1), color = "#4a90e2", alpha = 0.4, size = 1.2, 
             position = position_jitter(height = 0.02)) +
  # Amendments als Punkte (unten), gefärbt nach Status
  geom_point(data = amendment_final, aes(x = x, y = -0.1, color = as.factor(status_id)), alpha = 0.6, size = 1.2,
             position = position_jitter(height = 0.02)) +
  # Labels für die Extrempunkte (Personen)
  geom_text(data = person_final %>% filter(x == min(x) | x == max(x)), 
            aes(x = x, y = 0.15, label = name), vjust = 0, size = 2.5, check_overlap = TRUE) +
  theme_minimal() +
  scale_x_continuous(limits = c(-2.5, 2.5), breaks = seq(-2, 2, 1)) +
  scale_color_brewer(palette = "Set1", name = "Status ID") +
  labs(title = "1D Ideologie-Layout (R-Version)",
       subtitle = "Blau: Personen (oben), Bunt: Anträge nach Status (unten)",
       x = "Relative Position (-1 bis 1)",
       y = "") +
  theme(
    axis.text.y = element_blank(),
    axis.ticks.y = element_blank(),
    panel.grid.minor = element_blank(),
    plot.title = element_text(face = "bold", size = 14),
    plot.subtitle = element_text(color = "gray30")
  )

# Speichern
output_file <- file.path(sub_dir, "person_layout_r.png")
ggsave(output_file, plot, width = 12, height = 5, dpi = 300)

# Plot direkt anzeigen
if (interactive()) {
  # In RStudio oder interaktiver Konsole
  print(plot)
} else {
  # Wenn über die Konsole (Rscript) ausgeführt, ein Fenster öffnen
  cat("Öffne Plot-Fenster...\n")
  if (.Platform$OS.type == "windows") {
    windows(width = 12, height = 6)
  } else {
    x11(width = 12, height = 6)
  }
  print(plot)
  cat("Drücke [Enter], um das Fenster zu schließen...")
  readline()
}

cat("Fertig!\n")
# Koordinaten exportieren
coords_output <- file.path(sub_dir, "person_positions_r.json")
person_final %>%
  select(id, name, value = x) %>%
  toJSON(pretty = TRUE) %>%
  writeLines(coords_output)

amendment_output <- file.path(sub_dir, "amendment_positions_r.json")
amendment_final %>%
  select(id, title, status_id, value = x) %>%
  toJSON(pretty = TRUE) %>%
  writeLines(amendment_output)

# 5. In Datenbank schreiben
cat("\nSchreibe Koordinaten in die Datenbank...\n")
con <- dbConnect(SQLite(), db_path)

dbBegin(con)
tryCatch({
  # Personen-Positionen updaten
  for (i in 1:nrow(person_final)) {
    dbExecute(con, "UPDATE persons SET pos_1d = ? WHERE id = ?", 
              list(person_final$x[i], person_final$id[i]))
  }
  
  # Antrags-Positionen updaten
  for (i in 1:nrow(amendment_final)) {
    dbExecute(con, "UPDATE amendments SET pos_1d = ? WHERE id = ?", 
              list(amendment_final$x[i], amendment_final$id[i]))
  }
  
  dbCommit(con)
  cat("Datenbank-Update erfolgreich abgeschlossen.\n")
}, error = function(e) {
  dbRollback(con)
  cat("Fehler beim Datenbank-Update:", e$message, "\n")
})

# Zusätzlicher Export für die Tabellenansicht
cat("Exportiere Tabellendaten für Web-Ansicht...\n")
full_amendments <- dbGetQuery(con, "SELECT id, title, status_id, pos_1d FROM amendments")
full_persons <- dbGetQuery(con, "SELECT id, display_name as name, pos_1d FROM persons")

toJSON(list(amendments = full_amendments, persons = full_persons), pretty = TRUE) %>%
  writeLines("db_export.json")

dbDisconnect(con)

cat("\nFertig!\n")
cat(sprintf("- %d Personen verarbeitet\n", nrow(person_final)))
cat(sprintf("- %d Amendments verarbeitet\n", nrow(amendment_final)))
cat(sprintf("- Grafik gespeichert in: %s\n", output_file))
cat(sprintf("- Personen-Koordinaten: %s\n", coords_output))
cat(sprintf("- Antrags-Koordinaten: %s\n", amendment_output))
