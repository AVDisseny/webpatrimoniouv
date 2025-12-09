package irtic.uv.es.patrimoniouv;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@WebListener
public class ThreadPoolContextListener implements ServletContextListener {

    // Clave para almacenar y recuperar el ExecutorService del contexto
    public static final String EXECUTOR_SERVICE = "WebPatrimonioUV_ExecutorService";

    // 1. EL MÉTODO DE INICIO (Cuando la aplicación arranca)
    @Override
    public void contextInitialized(ServletContextEvent sce) {
        ServletContext context = sce.getServletContext();
        
        // ** CREACIÓN DEL POOL **
        // Crear un pool de hilos de tamaño fijo (ej: 50 hilos) para llamadas al servicio web
        ExecutorService executor = Executors.newFixedThreadPool(50); 
        
        // Almacenar el pool en el contexto de la aplicación
        context.setAttribute(EXECUTOR_SERVICE, executor);
        context.log("ThreadPoolContextListener: ExecutorService iniciado y almacenado en el contexto.");
    }

    // 2. EL MÉTODO DE DESTRUCCIÓN (Cuando la aplicación se detiene)
    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        ServletContext context = sce.getServletContext();
        ExecutorService executor = (ExecutorService) context.getAttribute(EXECUTOR_SERVICE);
        
        if (executor != null) {
            context.log("ThreadPoolContextListener: Apagando ExecutorService.");
            
            // Apagado elegante: rechaza nuevas tareas, pero completa las existentes.
            executor.shutdown();
            try {
                // Esperar a que las tareas terminen (máx. 60 segundos)
                if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                    // Si no termina, forzar el apagado (opcional)
                    executor.shutdownNow();
                    context.log("ThreadPoolContextListener: ExecutorService forzado a apagarse.");
                }
            } catch (InterruptedException e) {
                // Si el hilo actual es interrumpido, forzar el apagado
                executor.shutdownNow();
                Thread.currentThread().interrupt(); 
            }
        }
    }
}