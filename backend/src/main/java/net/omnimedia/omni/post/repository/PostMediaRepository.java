package net.omnimedia.omni.post.repository;

import net.omnimedia.omni.post.entity.PostMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostMediaRepository extends JpaRepository<PostMedia, Long> {
    List<PostMedia> findByPostIdOrderByPositionAsc(Long postId);
}
