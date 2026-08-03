// Import-only (sin exports): junta el CSS base de driver.js con nuestro
// reskin en UN solo chunk, en ESTE orden. Importarlos como dos import()
// dinámicos separados (como estaba antes) no garantiza el orden de
// inserción en <head> — si el override llegaba a cargar primero, driver.css
// lo pisaba y el tour se veía con el estilo por defecto de la librería.
import "driver.js/dist/driver.css";
import "@/styles/driver-theme.css";
