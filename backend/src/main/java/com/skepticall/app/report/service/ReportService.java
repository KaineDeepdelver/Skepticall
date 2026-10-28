package com.skepticall.app.report.service;

import com.skepticall.app.exceptions.BusinessException;
import com.skepticall.app.exceptions.ErrorType;
import com.skepticall.app.group.entity.GroupConversation;
import com.skepticall.app.group.entity.GroupMessage;
import com.skepticall.app.group.repository.GroupConversationRepository;
import com.skepticall.app.group.repository.GroupMessageRepository;
import com.skepticall.app.message.entity.Message;
import com.skepticall.app.message.repository.MessageRepository;
import com.skepticall.app.report.dto.ReportDTO;
import com.skepticall.app.report.entity.Report;
import com.skepticall.app.report.repository.ReportRepository;
import com.skepticall.app.user.entity.User;
import com.skepticall.app.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reports from people about people, messages and groups, and the review of them by admins.
 *
 * <p>The checks here exist so a report is about something the reporter could actually have seen:
 * you can only report a message you received, or a message or group you are part of.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    public static final Set<String> TARGET_TYPES = Set.of("USER", "MESSAGE", "GROUP", "GROUP_MESSAGE");
    public static final Set<String> REASONS = Set.of(
            "SPAM", "HARASSMENT", "HATE", "SEXUAL_CONTENT", "VIOLENCE", "SELF_HARM",
            "CHILD_SAFETY", "IMPERSONATION", "ILLEGAL", "OTHER");

    static final int MAX_DETAILS = 1000;
    static final int MAX_EVIDENCE = 4000;
    static final int MAX_PER_DAY = 10;

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final GroupConversationRepository groupRepository;
    private final GroupMessageRepository groupMessageRepository;

    // == Filing ================================================================

    /** Files a report. Filing the same open report twice returns the first one. */
    @Transactional
    public ReportDTO submit(Long reporterId, String targetType, Long targetId,
                            String reason, String details, String evidence) {
        String type = targetType == null ? "" : targetType.trim().toUpperCase();
        String why = reason == null ? "" : reason.trim().toUpperCase();
        if (!TARGET_TYPES.contains(type)) throw invalid("Unknown report type");
        if (!REASONS.contains(why)) throw invalid("Unknown report reason");
        if (targetId == null) throw invalid("Nothing to report");

        Long targetUserId = resolveTargetUser(reporterId, type, targetId);

        var existing = reportRepository.findFirstByReporterIdAndTargetTypeAndTargetIdAndStatus(
                reporterId, type, targetId, Report.OPEN);
        if (existing.isPresent()) {
            return ReportDTO.builder().id(existing.get().getId()).status(existing.get().getStatus()).build();
        }
        if (reportRepository.countByReporterIdAndCreatedAtAfter(reporterId, LocalDateTime.now().minusDays(1)) >= MAX_PER_DAY) {
            throw invalid("You have sent a lot of reports today. Please try again tomorrow.");
        }

        Report saved = reportRepository.save(Report.builder()
                .reporterId(reporterId)
                .targetType(type)
                .targetId(targetId)
                .targetUserId(targetUserId)
                .reason(why)
                .details(clip(details, MAX_DETAILS))
                .evidence("MESSAGE".equals(type) || "GROUP_MESSAGE".equals(type) ? clip(evidence, MAX_EVIDENCE) : null)
                .status(Report.OPEN)
                .build());
        log.warn("🚩 New report [id={}, type={}, reason={}]", saved.getId(), type, why);
        return ReportDTO.builder().id(saved.getId()).status(saved.getStatus()).build();
    }

    /** Works out who the report is about, and refuses reports the reporter had no way to make. */
    private Long resolveTargetUser(Long reporterId, String type, Long targetId) {
        switch (type) {
            case "USER": {
                if (reporterId.equals(targetId)) throw invalid("You cannot report yourself");
                if (!userRepository.existsById(targetId)) throw notFound("User", targetId);
                return targetId;
            }
            case "MESSAGE": {
                Message m = messageRepository.findById(targetId).orElseThrow(() -> notFound("Message", targetId));
                if (m.getReceiver() == null || !reporterId.equals(m.getReceiver().getId())) {
                    throw new BusinessException(ErrorType.PERMISSION_DENIED, "You can only report messages you received");
                }
                return m.getSender().getId();
            }
            case "GROUP": {
                GroupConversation g = groupRepository.findById(targetId).orElseThrow(() -> notFound("Group", targetId));
                requireMember(g, reporterId);
                return null;
            }
            default: { // GROUP_MESSAGE
                GroupMessage gm = groupMessageRepository.findById(targetId).orElseThrow(() -> notFound("Group message", targetId));
                requireMember(gm.getGroup(), reporterId);
                if (reporterId.equals(gm.getSender().getId())) throw invalid("You cannot report your own message");
                return gm.getSender().getId();
            }
        }
    }

    private void requireMember(GroupConversation g, Long userId) {
        boolean member = g.getMembers().stream().anyMatch(u -> userId.equals(u.getId()));
        if (!member) throw new BusinessException(ErrorType.PERMISSION_DENIED, "You are not in this group");
    }

    // == Review (the controller checks the caller is an admin) ==================

    /** Open reports oldest first, or the latest reports of every status when {@code status} is blank. */
    @Transactional(readOnly = true)
    public List<ReportDTO> list(String status) {
        List<Report> reports = (status == null || status.isBlank())
                ? reportRepository.findTop200ByOrderByCreatedAtDesc()
                : reportRepository.findTop200ByStatusOrderByCreatedAtAsc(status.trim().toUpperCase());

        Set<Long> ids = new HashSet<>();
        reports.forEach(r -> {
            ids.add(r.getReporterId());
            if (r.getTargetUserId() != null) ids.add(r.getTargetUserId());
        });
        Map<Long, String> names = new HashMap<>();
        for (User u : userRepository.findAllById(ids)) names.put(u.getId(), u.getUsername());

        return reports.stream().map(r -> ReportDTO.builder()
                .id(r.getId())
                .status(r.getStatus())
                .reporterId(r.getReporterId())
                .reporterUsername(names.get(r.getReporterId()))
                .targetType(r.getTargetType())
                .targetId(r.getTargetId())
                .targetUserId(r.getTargetUserId())
                .targetUsername(r.getTargetUserId() == null ? null : names.get(r.getTargetUserId()))
                .reason(r.getReason())
                .details(r.getDetails())
                .evidence(r.getEvidence())
                .resolutionNote(r.getResolutionNote())
                .createdAt(r.getCreatedAt())
                .handledAt(r.getHandledAt())
                .build()).toList();
    }

    /** Closes a report as RESOLVED (acted on) or DISMISSED (no action needed). */
    @Transactional
    public ReportDTO resolve(Long adminId, Long reportId, String status, String note) {
        String s = status == null ? "" : status.trim().toUpperCase();
        if (!Report.RESOLVED.equals(s) && !Report.DISMISSED.equals(s)) throw invalid("Status must be RESOLVED or DISMISSED");
        Report r = reportRepository.findById(reportId).orElseThrow(() -> notFound("Report", reportId));
        r.setStatus(s);
        r.setResolutionNote(clip(note, MAX_DETAILS));
        r.setHandledBy(adminId);
        r.setHandledAt(LocalDateTime.now());
        reportRepository.save(r);
        return ReportDTO.builder().id(r.getId()).status(r.getStatus()).build();
    }

    // == helpers =================================================================

    static String clip(String s, int max) {
        if (s == null) return null;
        String t = s.strip();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(ErrorType.INVALID_OPERATION, message);
    }

    private static BusinessException notFound(String what, Long id) {
        return new BusinessException(ErrorType.NOT_FOUND, what + " not found [id=" + id + "]");
    }
}
