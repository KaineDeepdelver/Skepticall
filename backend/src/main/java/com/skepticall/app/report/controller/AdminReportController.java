package com.skepticall.app.report.controller;

import com.skepticall.app.admin.service.AdminService;
import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.report.dto.ReportDTO;
import com.skepticall.app.report.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Review queue for admins. Acting on a report (deleting an account or group) uses the existing /admin endpoints. */
@RestController
@RequestMapping("/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private final AdminService adminService;
    private final ReportService reportService;

    private Long callerId(HttpServletRequest req) {
        Long id = (Long) req.getAttribute("authenticatedUserId");
        if (id == null) {
            throw new BusinessException(ErrorType.INVALID_TOKEN, "Not authenticated");
        }
        return id;
    }

    /** Open reports, oldest first. Pass {@code ?status=RESOLVED|DISMISSED} for closed ones, {@code ?status=} for the latest of all. */
    @GetMapping
    public ResponseEntity<List<ReportDTO>> list(@RequestParam(defaultValue = "OPEN") String status, HttpServletRequest req) {
        adminService.requireAdmin(callerId(req));
        return ResponseEntity.ok(reportService.list(status));
    }

    /** Body: {"status": "RESOLVED|DISMISSED", "note": "optional"}. */
    @PostMapping("/{id}/resolve")
    public ResponseEntity<ReportDTO> resolve(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest req) {
        Long adminId = callerId(req);
        adminService.requireAdmin(adminId);
        return ResponseEntity.ok(reportService.resolve(adminId, id, body.get("status"), body.get("note")));
    }
}
