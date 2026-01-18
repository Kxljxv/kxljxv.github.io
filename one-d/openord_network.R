# openord_network.R
# Dieses Skript berechnet ein 2D-Netzwerk-Layout (OpenOrd/DrL) von Personen und Amendments.

# Benötigte Pakete prüfen und ggf. installieren
required_packages <- c("RSQLite", "jsonlite", "ggplot2", "dplyr", "tidyr", "purrr", "igraph", "ggraph")
new_packages <- required_packages[!(required_packages %in% installed.packages()[,"Package"])]
if(length(new_packages)) install.packages(new_packages)

suppressPackageStartupMessages({
  library(RSQLite)
  library(jsonlite)
  library(ggplot2)
  library(dplyr)
  library(tidyr)
  library(purrr)
  library(igraph)
  library(ggraph)
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
amendments <- dbGetQuery(con, "SELECT id, title, initiators, supporters, status_id FROM amendments")
persons_db <- dbGetQuery(con, "SELECT id, display_name FROM persons")
dbDisconnect(con)

# 2. Daten vorverarbeiten
cat("Verarbeite Beziehungen...\n")

person_list <- persons_db %>% rename(name = display_name)
person_name_to_id <- person_list$id
names(person_name_to_id) <- person_list$name

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
      if (p_name %in% names(person_name_to_id)) {
        links[[length(links) + 1]] <- data.frame(
          from = as.character(person_name_to_id[p_name]),
          to = paste0("am_", a$id),
          weight = 3.0,
          type = "initiator",
          stringsAsFactors = FALSE
        )
      }
    }
  }
  
  # Supporter (Gewicht 1.5 bis 1.0)
  supps <- parse_participants(a$supporters)
  if (!is.null(supps) && "name" %in% names(supps)) {
    n_supps <- nrow(supps)
    for (j in 1:n_supps) {
      p_name <- supps$name[j]
      if (p_name %in% names(person_name_to_id)) {
        weight <- if (n_supps > 1) 1.5 - 0.5 * ((j - 1) / (n_supps - 1)) else 1.5
        links[[length(links) + 1]] <- data.frame(
          from = as.character(person_name_to_id[p_name]),
          to = paste0("am_", a$id),
          weight = weight,
          type = "supporter",
          stringsAsFactors = FALSE
        )
      }
    }
  }
}

links_df <- bind_rows(links)

# 3. Graph erstellen
cat("Erstelle Graph...\n")

nodes_persons <- person_list %>% 
  mutate(node_id = as.character(id), label = name, node_type = "person") %>%
  select(node_id, label, node_type)

nodes_amendments <- amendments %>%
  mutate(node_id = paste0("am_", id), label = title, node_type = "amendment") %>%
  select(node_id, label, node_type)

nodes <- bind_rows(nodes_persons, nodes_amendments)

g <- graph_from_data_frame(d = links_df, vertices = nodes, directed = FALSE)
cat(sprintf("Graph erstellt: %d Nodes, %d Edges\n", vcount(g), ecount(g)))

# 3.1 Nur größte zusammenhängende Komponente behalten
cat("Filtere größte zusammenhängende Komponente...\n")
comp <- components(g)
largest_comp_id <- which.max(comp$csize)
nodes_in_largest <- V(g)[comp$membership == largest_comp_id]
g <- induced_subgraph(g, nodes_in_largest)

cat(sprintf("Größte Komponente: %d Nodes, %d Edges (von ursprünglich %d Nodes)\n", 
            vcount(g), ecount(g), length(comp$membership)))

# 4. Layout berechnen
cat("Berechne Layout...\n")
# Wir verwenden DrL als Fallback, da OpenOrd oft nicht direkt exportiert wird
layout_coords <- layout_with_drl(g, weights = E(g)$weight)

V(g)$x <- layout_coords[, 1]
V(g)$y <- layout_coords[, 2]

# 5. Export
cat("Exportiere CSV...\n")
tryCatch({
  node_data <- data.frame(
    id = V(g)$name,
    label = V(g)$label,
    type = V(g)$node_type,
    x = V(g)$x,
    y = V(g)$y,
    stringsAsFactors = FALSE
  )
  write.csv(node_data, file.path(sub_dir, "node_positions_openord.csv"), row.names = FALSE)
  cat("CSV erfolgreich exportiert.\n")
}, error = function(e) {
  cat("Fehler beim CSV-Export:", e$message, "\n")
})

cat("Exportiere JSON...\n")
tryCatch({
  person_coords <- node_data %>% filter(type == "person")
  amendment_coords <- node_data %>% filter(type == "amendment")
  writeLines(toJSON(person_coords, pretty = TRUE), file.path(sub_dir, "person_positions_openord.json"))
  writeLines(toJSON(amendment_coords, pretty = TRUE), file.path(sub_dir, "amendment_positions_openord.json"))
  cat("JSON erfolgreich exportiert.\n")
}, error = function(e) {
  cat("Fehler beim JSON-Export:", e$message, "\n")
})

# 6. Visualisierung
cat("Speichere Grafik...\n")
plot <- ggraph(g, layout = "manual", x = V(g)$x, y = V(g)$y) +
  geom_edge_link(aes(alpha = weight, color = type), show.legend = FALSE) +
  geom_node_point(aes(color = node_type), size = 2) +
  theme_void() +
  scale_color_manual(values = c("person" = "blue", "amendment" = "orange"))


# Plot direkt anzeigen
if (interactive()) {
  # In RStudio oder interaktiver Konsole
  print(plot)
} else {
  # Wenn über die Konsole (Rscript) ausgeführt, ein Fenster öffnen
  cat("Öffne Plot-Fenster...\n")
  if (.Platform$OS.type == "windows") {
    windows(width = 10, height = 10)
  } else {
    x11(width = 10, height = 10)
  }
  print(plot)
  cat("Drücke [Enter], um das Fenster zu schließen...")
  readline()
}

cat("Fertig!\n")
