
## Main SQL
The Main SQL contains three tables. One for all Motions, one for all Amendments and on for every Person. 

### Motion Table
Fields:
- "id"
- "agenda_item"
- "prefix"
- "title"
- "title_with_intro"
- "title_with_prefix"
- "status_id"
- "status_title"
- "proposed_procedure"
- "date_published"
- "initiators" (list)
	- "type"
	- "name"
	- "organisation" (only filled, when "type" says "organization") 
	- "person_id" (only filled, when "type" says "person") 
	- "kv" (when "type" == "person", this value takes on the "organization" value from the REST API) 
- "supporters" (list)
	- "type"
	- "name"
	- "organisation" (only filled, when "type" says "organization") 
	- "person_id" (only filled, when "type" says "person") 
	- "kv" (when "type" == "person", this value takes on the "organization" value from the REST API) 
- "sections" (list)
	- "type"
	- "title"
	- "html"
- "amendment_links"
- "url_json"
- "url_html"

### amendment Table
Fields:
- "id"
- "prefix"
- "title"
- "title_with_prefix"
- "status_id"
- "status_title"
- "proposed_procedure"
- "date_published"
- "initiators" (list)
	- "type"
	- "name"
	- "organisation" (only filled, when "type" says "organization") 
	- "person_id" (only filled, when "type" says "person") 
	- "kv" (when "type" == "person", this value takes on the "organization" value from the REST API) 
- "supporters" (list)
	- "type"
	- "name"
	- "organisation" (only filled, when "type" says "organization") 
	- "person_id" (only filled, when "type" says "person") 
	- "kv" (when "type" == "person", this value takes on the "organization" value from the REST API) 
- "sections" (list)
	- "type"
	- "title"
	- "html"
- "url_json"
- "url_html"

### person table

Fields:
- "id"
- "display_name" (name before id formatting)
- "kv" (list) (contains a list of all kv's that the person was in)
- "active_conventions" (list) (a list of all conventions, the person was active in)
- "timeline" (list) (a list with timestamps, when the person has been active (the "date_published" values are used as measurment))
	- "date"
	- "initiating" (bool) (determines, whether this timestamp comes from an amendment/motion, that has been initiated by the person)
- "initiated" (list) (all motions/amendments, the person has initiated)
	- "id"
	- "type"
	- "convention"
	- "date_published"
	- "status_title"
	- "status_id"
- "supported" (list) (all motions/amendments, the person has supported)
	- "id"
	- "type"
	- "convention"
	- "date_published"
	- "status_title"
	- "status_id"

 