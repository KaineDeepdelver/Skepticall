package com.skepticall.app.report.repository;

import com.skepticall.app.report.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ReportRepository extends JpaRepository<Report, Long> {

    List<Report> findTop200ByStatusOrderByCreatedAtAsc(String status);

    List<Report> findTop200ByOrderByCreatedAtDesc();

    Optional<Report> findFirstByReporterIdAndTargetTypeAndTargetIdAndStatus(
            Long reporterId, String targetType, Long targetId, String status);

    long countByReporterIdAndCreatedAtAfter(Long reporterId, LocalDateTime since);
}
