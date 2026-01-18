# openord_gui.R
# Eine Shiny-App zur interaktiven Steuerung und Echtzeit-Beobachtung des DrL/OpenOrd-Algorithmus

required_packages <- c("shiny", "RSQLite", "jsonlite", "ggplot2", "dplyr", "igraph", "ggraph", "bslib")
new_packages <- required_packages[!(required_packages %in% installed.packages()[,"Package"])]
if(length(new_packages)) install.packages(new_packages, repos='https://cran.rstudio.com/')

library(shiny)
library(RSQLite)
library(jsonlite)
library(ggplot2)
library(dplyr)
library(igraph)
library(ggraph)
library(bslib)

# --- DATEN LADEN ---
base_dir <- "c:/Users/kolja/Desktop/ldk-26-1-schnell"
sub_dir <- "one-dimensional"
setwd(base_dir)
db_path <- file.path(sub_dir, "final_data.db")

con <- dbConnect(SQLite(), db_path)
amendments <- dbGetQuery(con, "SELECT id, title, initiators, supporters FROM amendments")
persons_db <- dbGetQuery(con, "SELECT id, display_name FROM persons")
dbDisconnect(con)

person_name_to_id <- persons_db$id
names(person_name_to_id) <- persons_db$display_name

parse_participants <- function(json_str) {
  if (is.na(json_str) || json_str == "[]" || json_str == "") return(NULL)
  tryCatch({ fromJSON(json_str) }, error = function(e) NULL)
}

links <- list()
for (i in 1:nrow(amendments)) {
  a <- amendments[i, ]
  inits <- parse_participants(a$initiators)
  if (!is.null(inits)) {
    for (p_name in inits$name) {
      if (p_name %in% names(person_name_to_id)) {
        links[[length(links) + 1]] <- data.frame(from = as.character(person_name_to_id[p_name]), to = paste0("am_", a$id), weight = 3.0, type = "initiator")
      }
    }
  }
  supps <- parse_participants(a$supporters)
  if (!is.null(supps)) {
    n_supps <- nrow(supps)
    for (j in 1:n_supps) {
      p_name <- supps$name[j]
      if (p_name %in% names(person_name_to_id)) {
        weight <- if (n_supps > 1) 1.5 - 0.5 * ((j - 1) / (n_supps - 1)) else 1.5
        links[[length(links) + 1]] <- data.frame(from = as.character(person_name_to_id[p_name]), to = paste0("am_", a$id), weight = weight, type = "supporter")
      }
    }
  }
}
links_df <- bind_rows(links)
nodes <- bind_rows(
  persons_db %>% mutate(node_id = as.character(id), label = display_name, node_type = "person") %>% select(node_id, label, node_type),
  amendments %>% mutate(node_id = paste0("am_", id), label = title, node_type = "amendment") %>% select(node_id, label, node_type)
)
g_full <- graph_from_data_frame(d = links_df, vertices = nodes, directed = FALSE)
comp <- components(g_full)
g <- induced_subgraph(g_full, V(g_full)[comp$membership == which.max(comp$csize)])

# Hilfsfunktion für Phasen-UI
phase_ui <- function(id, label, phase_name, defaults) {
  accordion_panel(
    label,
    sliderInput(paste0(id, "_iter"), "Iterationen:", min = 0, max = 1000, value = defaults[[paste0(phase_name, ".iterations")]]),
    sliderInput(paste0(id, "_temp"), "Temperatur:", min = 0, max = 5000, value = defaults[[paste0(phase_name, ".temperature")]]),
    sliderInput(paste0(id, "_attr"), "Anziehung:", min = 0, max = 10, value = defaults[[paste0(phase_name, ".attraction")]], step = 0.1),
    sliderInput(paste0(id, "_damp"), "Dämpfung:", min = 0, max = 1, value = defaults[[paste0(phase_name, ".damping.mult")]], step = 0.01)
  )
}

# --- SHINY UI ---
ui <- page_sidebar(
  theme = bs_theme(version = 5, bootswatch = "flatly"),
  title = "OpenOrd Live-Simulator",
  sidebar = sidebar(
    width = 400,
    h4("Simulationseinstellungen"),
    p("Der Algorithmus wird in Echtzeit visualisiert."),
    accordion(
      accordion_panel(
        "Was bedeuten die Parameter?",
        icon = icon("info-circle"),
        p(strong("Temperatur:"), " Bestimmt die maximale Sprungdistanz der Knoten. Hohe Werte am Anfang (Liquid) lassen Knoten grob ihre Plätze finden. Niedrige Werte am Ende (Simmer) erlauben feines 'Einrasten'."),
        p(strong("Anziehung:"), " Verstärkt die Kraft zwischen verbundenen Knoten. Höhere Werte führen zu dichteren Clustern. Zu hohe Werte können alles auf einen Punkt zusammenziehen."),
        p(strong("Abstoßung (Edge Cut):"), " Bestimmt, ab welcher Distanz die Anziehung zwischen Knoten gekappt wird. Höhere Werte (Richtung 1) führen dazu, dass Knoten sich stärker 'abstoßen' bzw. weniger stark zusammengezogen werden, was das Layout luftiger macht."),
        p(strong("Dämpfung:"), " Kontrolliert, wie stark die Bewegung abgebremst wird. Eine hohe Dämpfung verhindert 'Oszillieren' (Hin- und Her-Springen) der Knoten und stabilisiert das Layout.")
      ),
      accordion_panel(
        "Globale Einstellungen",
        icon = icon("globe"),
        sliderInput("edge_cut", "Abstoßung (Edge Cut):", min = 0, max = 1, value = drl_defaults$default$edge.cut, step = 0.01),
        helpText("0 = Maximale Anziehung, 1 = Maximale Abstoßung/Trennung")
      ),
      phase_ui("liq", "1. Liquid", "liquid", drl_defaults$default),
      phase_ui("exp", "2. Expansion", "expansion", drl_defaults$default),
      phase_ui("coo", "3. Cooldown", "cooldown", drl_defaults$default),
      phase_ui("cru", "4. Crunch", "crunch", drl_defaults$default),
      phase_ui("sim", "5. Simmer", "simmer", drl_defaults$default)
    ),
    hr(),
    div(style="display: flex; gap: 10px;",
        actionButton("run", "Simulation starten", class = "btn-primary", style="flex: 1"),
        actionButton("stop", "Stop", class = "btn-danger"),
        actionButton("reset", "Reset", class = "btn-warning")
    ),
    br(),
    actionButton("save", "Layout speichern", class = "btn-success", style="width: 100%"),
    hr(),
    uiOutput("status_ui")
  ),
  card(
    full_screen = TRUE,
    card_header("Netzwerk-Vorschau (Links werden am Ende eingeblendet)"),
    plotOutput("networkPlot", height = "800px")
  )
)

# --- SHINY SERVER ---
server <- function(input, output, session) {
  
  # Sitzung stabilisieren
  session$allowReconnect(TRUE)
  
  # Debug: Parameter-Namen prüfen
  observe({
    message("Verfügbare DrL-Parameter: ", paste(names(drl_defaults$default), collapse = ", "))
  })

  # Simulations-Status
  sim <- reactiveValues(
    coords = NULL,
    running = FALSE,
    phase_idx = 1,
    remaining_iters = 0,
    phases = c("liquid", "expansion", "cooldown", "crunch", "simmer"),
    phase_prefixes = c("liq", "exp", "coo", "cru", "sim"),
    all_phases = c("init", "liquid", "expansion", "cooldown", "crunch", "simmer"), # Inklusive init
    finished = FALSE
  )
  
  # Initialisiere Koordinaten beim Start
  observe({
    if (is.null(sim$coords)) {
      message("Initialisiere Koordinaten...")
      sim$coords <- layout_with_drl(g, options = list(iterations=0))
    }
  })

  # Start-Button
  observeEvent(input$run, {
    message("Simulation gestartet.")
    sim$running <- TRUE
    sim$phase_idx <- 1
    sim$finished <- FALSE
    # Starte mit aktuellen oder zufälligen Koordinaten
    if (is.null(sim$coords)) {
        sim$coords <- layout_with_drl(g, options = list(iterations=0))
    }
    # Setze restliche Iterationen für die erste Phase
    sim$remaining_iters <- input[[paste0(sim$phase_prefixes[1], "_iter")]]
    message("Erste Phase: ", sim$phases[1], " mit ", sim$remaining_iters, " Iterationen.")
  })
  
  # Stop-Button
  observeEvent(input$stop, {
    message("Simulation gestoppt.")
    sim$running <- FALSE
  })
  
  # Reset-Button
  observeEvent(input$reset, {
    message("Layout zurückgesetzt.")
    sim$running <- FALSE
    sim$finished <- FALSE
    sim$phase_idx <- 1
    sim$remaining_iters <- 0
    sim$coords <- layout_with_drl(g, options = list(iterations=0))
  })
  
  # Simulations-Loop (Iterative Ausführung)
  observe({
    if (!sim$running) return()
    
    # invalidateLater an den Anfang setzen, um die Schleife sicher am Leben zu halten
    invalidateLater(50)
    
    isolate({
      curr_phase <- sim$phases[sim$phase_idx]
      curr_prefix <- sim$phase_prefixes[sim$phase_idx]
      
      # Wenn keine Iterationen mehr in dieser Phase, zur nächsten springen
      if (sim$remaining_iters <= 0) {
        sim$phase_idx <- sim$phase_idx + 1
        
        if (sim$phase_idx > length(sim$phases)) {
          message(">>> Simulation erfolgreich beendet.")
          sim$running <- FALSE
          sim$finished <- TRUE
          return()
        }
        
        curr_prefix <- sim$phase_prefixes[sim$phase_idx]
        val <- input[[paste0(curr_prefix, "_iter")]]
        sim$remaining_iters <- if(is.null(val)) 0 else as.integer(val)
        
        message(">>> Wechsle zu Phase ", sim$phase_idx, ": ", sim$phases[sim$phase_idx], " (Iterationen: ", sim$remaining_iters, ")")
        
        # Falls die neue Phase 0 Iterationen hat, wird sie im nächsten Zyklus übersprungen
        return()
      }

      # Schrittweite
      step_size <- 20
      iters_to_run <- min(step_size, sim$remaining_iters)
      
      # Heartbeat Log VOR der Berechnung
      message("Step: ", curr_phase, " [", sim$phase_idx, "] | iters: ", iters_to_run, " | remaining: ", sim$remaining_iters - iters_to_run)
      
      # Parameter-Liste vorbereiten
      params <- drl_defaults$default
      for(p in sim$all_phases) params[[paste0(p, ".iterations")]] <- 0
      
      params[[paste0(curr_phase, ".iterations")]] <- iters_to_run
      params[[paste0(curr_phase, ".temperature")]] <- input[[paste0(curr_prefix, "_temp")]]
      params[[paste0(curr_phase, ".attraction")]] <- input[[paste0(curr_prefix, "_attr")]]
      
      damp_key <- paste0(curr_phase, ".damping.mult")
      if (!(damp_key %in% names(params))) damp_key <- paste0(curr_phase, ".damping")
      params[[damp_key]] <- input[[paste0(curr_prefix, "_damp")]]
      
      # Abstoßungswert (Edge Cut) setzen
      params$edge.cut <- input$edge_cut
      
      # Ausführen
      tryCatch({
        new_coords <- layout_with_drl(g, use.seed = TRUE, seed = sim$coords, options = params, weights = E(g)$weight)
        
        if (any(is.na(new_coords)) || any(is.infinite(new_coords))) {
          message("WARNUNG: Instabile Berechnung in Phase ", curr_phase)
          sim$remaining_iters <- 0
        } else {
          sim$coords <- new_coords
          sim$remaining_iters <- sim$remaining_iters - iters_to_run
        }
      }, error = function(e) {
        message("FEHLER: ", e$message)
        sim$running <- FALSE
      })
    })
  })
  
  # Status Anzeige
  output$status_ui <- renderUI({
    if (sim$running) {
      wellPanel(
        p(span(class="badge bg-primary", "Aktiv"), paste(" Phase:", sim$phases[sim$phase_idx])),
        p(small(paste("Verbleibende Iterationen in Phase:", sim$remaining_iters))),
        div(class="progress",
            div(class="progress-bar progress-bar-striped progress-bar-animated", 
                style=paste0("width: ", (1 - sim$remaining_iters / max(1, input[[paste0(sim$phase_prefixes[sim$phase_idx], "_iter")]])) * 100, "%"))
        )
      )
    } else if (sim$finished) {
      span(class="badge bg-success", "Simulation abgeschlossen!")
    } else {
      span(class="badge bg-secondary", "Bereit für Start")
    }
  })
  
  # Plot ausgeben
  output$networkPlot <- renderPlot({
    l <- sim$coords
    if (is.null(l)) return(NULL)
    
    V(g)$x <- l[, 1]
    V(g)$y <- l[, 2]
    
    p <- ggraph(g, layout = "manual", x = V(g)$x, y = V(g)$y)
    
    # Links nur anzeigen, wenn NICHT simuliert wird (Performance!)
    if (!sim$running && sim$finished) {
      p <- p + geom_edge_link(aes(alpha = weight, color = type), show.legend = FALSE)
    }
    
    p + geom_node_point(aes(color = node_type), size = 1.5) +
      theme_void() +
      scale_color_manual(values = c("person" = "#1f77b4", "amendment" = "#ff7f0e")) +
      labs(caption = if(sim$running) "Links ausgeblendet während Simulation..." else "Blau: Personen | Orange: Amendments")
  })
  
  # Speichern-Logik
  observeEvent(input$save, {
    l <- sim$coords
    V(g)$x <- l[, 1]
    V(g)$y <- l[, 2]
    node_data <- data.frame(id = V(g)$name, label = V(g)$label, type = V(g)$node_type, x = V(g)$x, y = V(g)$y)
    write.csv(node_data, file.path(sub_dir, "node_positions_gui.csv"), row.names = FALSE)
    ggsave(file.path(sub_dir, "network_layout_gui.png"), width = 12, height = 12, dpi = 300)
    showNotification("Gespeichert!", type = "message")
  })
}

# App starten
if (interactive()) {
  shinyApp(ui = ui, server = server)
} else {
  runApp(shinyApp(ui = ui, server = server), launch.browser = TRUE)
}
