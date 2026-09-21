package net.omnimedia.omni.util.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Tiny public endpoint for keep-alive pings (allowed without login in SecurityConfig). */
@RestController
public class PingController {

    @GetMapping("/ping")
    public String ping() {
        return "ok";
    }
}
