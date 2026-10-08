package net.omnimedia.omni.group.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.omnimedia.omni.common.BaseEntity;

import java.time.LocalDateTime;

/**
 * One row = "this member's device has received this group message". The server only keeps a
 * group message until every member (except the sender) has a row here, plus the retention delay.
 * Plain ids, no foreign keys, so deleting a message never has to touch these first.
 */
@Entity
@Table(name = "group_message_deliveries",
        uniqueConstraints = @UniqueConstraint(columnNames = {"groupMessageId", "userId"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GroupMessageDelivery extends BaseEntity {

    private Long groupMessageId;
    private Long userId;
    private LocalDateTime deliveredAt;
}
