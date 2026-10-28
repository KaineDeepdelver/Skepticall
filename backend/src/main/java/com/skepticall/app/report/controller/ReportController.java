package com.skepticall.app.report.controller;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.report.dto.ReportDTO;
import com.skepticall.app.report.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Anyone signed in can report something they have seen. */
@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    private Long callerId(HttpServletRequest req) {
        Long id = (Long) req.getAttribute("authenticatedUserId");
        if (id == null) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Not authenticated");
        }
        return id;
    }

    /**
     * Body: {"targetType": "USER|MESSAGE|GROUP|GROUP_MESSAGE", "targetId": 123,
     *        "reason": "HARASSMENT", "details": "optional", "evidence": "optional text of a reported message"}.
     */
    @PostMapping
    public ResponseEntity<ReportDTO> submit(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Object rawId = body.get("targetId");
        Long targetId = rawId instanceof Number ? ((Number) rawId).longValue() : null;
        return ResponseEntity.ok(reportService.submit(
                callerId(req),
                asText(body.get("targetType")),
                targetId,
                asText(body.get("reason")),
                asText(body.get("details")),
                asText(body.get("evidence"))));
    }

    private static String asText(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
