package irtic.uv.es.patrimoniouv;

import jakarta.servlet.AsyncContext;
import jakarta.servlet.ServletContext;
import jakarta.servlet.annotation.WebServlet; 
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;

// Nota: Cambié el urlPatterns a /api/* para abarcar /api/search y /api/status.
// El asyncSupported = true es esencial para la concurrencia.
@WebServlet(name = "SearchServlet", urlPatterns = "/api/*", asyncSupported = true)
public class SearchServlet extends HttpServlet {
    
    private static final long serialVersionUID = 1L;
    private static final String EXTERNAL_SERVICE_URL = "http://iacom.uv.es:50005/embeddings/retrieve?query=";

    // Clave para obtener el pool de hilos del contexto (debe coincidir con el Listener)
    private static final String EXECUTOR_KEY = ThreadPoolContextListener.EXECUTOR_SERVICE; 

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) 
            throws IOException {
        
        // 1. Configuración de Cabeceras (Rápido y Síncrono)
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*"); 
        
        String path = request.getRequestURI().substring(request.getContextPath().length());

        // 2. Lógica de Ruteo (Rápido y Síncrono)
        if ("/api/search".equals(path)) {
            // Tarea lenta: Delegar al pool de hilos de forma asíncrona
            handleSearchRequestAsync(request, response);
            
        } else if ("/api/status".equals(path)) {
            // Tarea rápida: Ejecutar de forma síncrona
            handleStatusRequest(response);
            
        } else {
            // Ruta no encontrada
            response.setStatus(HttpServletResponse.SC_NOT_FOUND); // 404
            response.getWriter().write("{\"status\": \"error\", \"message\": \"Ruta no encontrada\"}");
        }
    }
    
    /**
     * Adaptación de handleSearchRequest a la ejecución ASÍNCRONA.
     * Libera el hilo de Tomcat y ejecuta la llamada HTTP externa en un hilo del pool.
     */
    private void handleSearchRequestAsync(HttpServletRequest request, HttpServletResponse response) 
            throws IOException {

        // 1. Obtener el pool de hilos
        ServletContext context = getServletContext();
        ExecutorService executor = (ExecutorService) context.getAttribute(EXECUTOR_KEY);
        
        if (executor == null) {
            // Fallo si el pool no está inicializado (error de Listener)
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.getWriter().write("{\"status\": \"error\", \"message\": \"Pool de hilos no disponible.\"}");
            return;
        }

        // 2. INICIAR EL CONTEXTO ASÍNCRONO
        final AsyncContext asyncContext = request.startAsync(request, response);
        asyncContext.setTimeout(15000); // 15 segundos para toda la operación

        // 3. DELEGAR LA TAREA PESADA (Llamada HTTP externa) AL POOL
        executor.execute(() -> {
            // Este código se ejecuta en un hilo del ExecutorService, liberando el hilo de Tomcat.
            
            HttpServletResponse asyncResponse = (HttpServletResponse) asyncContext.getResponse();
            String query = asyncContext.getRequest().getParameter("q");
            
            if (query == null || query.trim().isEmpty()) {
                asyncResponse.setStatus(HttpServletResponse.SC_BAD_REQUEST); // 400
                try {
                    asyncResponse.getWriter().write("{\"status\": \"error\", \"message\": \"Falta el parámetro 'q' de búsqueda.\"}");
                } catch (IOException e) { /* Ignorar */ }
                asyncContext.complete();
                return;
            }

            // LÓGICA DE LLAMADA AL SERVICIO EXTERNO (Copiada de tu handleSearchRequest)
            String encodedQuery = null;
            try {
                encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
                String finalUrl = EXTERNAL_SERVICE_URL + encodedQuery;

                URL url = new URL(finalUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000); 
                connection.setReadTimeout(5000); 

                int status = connection.getResponseCode();

                if (status == HttpURLConnection.HTTP_OK) { // 200 OK
                    
                    try (BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                        String inputLine;
                        StringBuilder content = new StringBuilder();
                        while ((inputLine = in.readLine()) != null) {
                            content.append(inputLine);
                        }
                        
                        // 4. ÉXITO: Reenviar el JSON directamente
                        asyncResponse.setStatus(HttpServletResponse.SC_OK);
                        asyncResponse.getWriter().write(content.toString());
                    }
                } else {
                    // Error del servicio externo (código no 200)
                    asyncResponse.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR); // 500
                    asyncResponse.getWriter().write("{\"status\": \"error\", \"message\": \"Error del servicio externo. Código: " + status + "\"}");
                }

            } catch (Exception e) {
                // Error de conexión o URL mal formada
                asyncResponse.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR); // 500
                try {
                    asyncResponse.getWriter().write("{\"status\": \"error\", \"message\": \"Fallo en la comunicación con el servidor: " + e.getMessage() + "\"}");
                } catch (IOException ioE) { /* Ignorar */ }
                System.err.println("Error al conectar con el servicio externo: " + e.getMessage());
            } finally {
                // 5. FINALIZAR EL CONTEXTO ASÍNCRONO
                asyncContext.complete(); 
            }
        });
    }

    // El método handleSearchRequest original se ha eliminado o cambiado de nombre a handleSearchRequestAsync.
    
    // La lógica de handleStatusRequest (rápida) se mantiene síncrona
    private void handleStatusRequest(HttpServletResponse response) throws IOException {
        String jsonResponse = "{\"status_code\": 1, \"message\": \"Servicio ACTIVO\"}";
        response.setStatus(HttpServletResponse.SC_OK);
        response.getWriter().write(jsonResponse);
    }
    
    // El método performSearch original (simulación) ya no es necesario aquí.
}