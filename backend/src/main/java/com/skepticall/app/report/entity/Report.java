package com.skepticall.app.report.entity;

import com.skepticall.app.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A report about a person, a message, a group or a group message.
 *
 * <p>Messages are end-to-end encrypted, so the server cannot read the thing being reported. For a
 * message, {@code evidence} holds whatever text the reporter chose to send along: it is exactly what
 * their own app showed them, and it is not something the server can verify. The ids are plain numbers
 * rather than foreign keys, so a report survives the reported content being deleted.
 */
@Entity
@Table(name = "reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Report extends BaseEntity {

    public static final String OPEN = "OPEN";
    public static final String RESOLVED = "RESOLVED";
    public static final String DISMISSED = "DISMISSED";

    @Column(nullable = false)
    private Long reporterId;

    /** USER, MESSAGE, GROUP or GROUP_MESSAGE. */
    @Column(nullable = false, length = 20)
    private String targetType;

    @Column(nullable = false)
    private Long targetId;

    /** The person the report is about, when there is one (null for a whole group). */
    private Long targetUserId;

    @Column(nullable = false, length = 24)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    /** Text of a reported message, if the reporter chose to include it. */
    @Column(columnDefinition = "TEXT")
    private String evidence;

    /** OPEN, RESOLVED or DISMISSED. */
    @Column(nullable = false, length = 12)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String resolutionNote;

    private Long handledBy;

    private LocalDateTime handledAt;
}
