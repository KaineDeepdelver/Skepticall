package com.skepticall.app.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** A report as a moderator sees it. A reporter only ever gets {@code id} and {@code status} back. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportDTO {
    private Long id;
    private String status;

    private Long reporterId;
    private String reporterUsername;
    private String targetType;
    private Long targetId;
    private Long targetUserId;
    private String targetUsername;
    private String reason;
    private String details;
    private String evidence;
    private String resolutionNote;
    private LocalDateTime createdAt;
    private LocalDateTime handledAt;
}
