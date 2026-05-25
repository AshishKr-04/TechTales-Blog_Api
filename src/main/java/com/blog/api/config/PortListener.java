package com.blog.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

@Component
public class PortListener implements ApplicationListener<WebServerInitializedEvent> {
    private static final Logger logger = LoggerFactory.getLogger(PortListener.class);

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        int activePort = event.getWebServer().getPort();
        logger.info("===============================================================");
        logger.info("Server started programmatically on port: {}", activePort);
        logger.info("===============================================================");
    }
}
