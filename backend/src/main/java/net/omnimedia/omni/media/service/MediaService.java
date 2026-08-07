package net.omnimedia.omni.media.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.media.dto.MediaItemDTO;
import net.omnimedia.omni.media.entity.MediaItem;
import net.omnimedia.omni.media.entity.MediaVote;
import net.omnimedia.omni.media.repository.MediaItemRepository;
import net.omnimedia.omni.media.repository.MediaVoteRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.notification.service.NotificationService;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service @RequiredArgsConstructor
public class MediaService {
    private final MediaItemRepository mediaRepo;
    private final MediaVoteRepository voteRepo;
    private final UserRepository userRepo;
    private final NotificationService notifService;

    public List<MediaItemDTO> getFeed(int page, int size, Long viewerId) {
        return mediaRepo.findByIsClipFalseOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(m -> toDTO(m, viewerId)).toList();
    }

    /** Returns all clips in a randomly shuffled order for the shelf. */
    public List<MediaItemDTO> getClips(Long viewerId) {
        List<MediaItem> clips = mediaRepo.findByIsClipTrue();
        Collections.shuffle(clips);
        return clips.stream().map(m -> toDTO(m, viewerId)).toList();
    }

    @Transactional
    @CacheEvict(value = "user-media", key = "#authorId")
    public MediaItemDTO create(Long authorId, String title, String description,
                               String videoUrl, String thumbnailUrl,
                               boolean isClip, int durationSeconds) {
        if (isClip && durationSeconds > 300) {
            throw new BusinessException(
                    ErrorType.INVALID_OPERATION,
                    "Clips cannot exceed 5 minutes (300 seconds) [durationSeconds=" + durationSeconds + "]"
            );
        }

        User author = userRepo.findById(authorId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Author profile not found [authorId=" + authorId + "]"));

        MediaItem item = MediaItem.builder()
                .author(author).title(title).description(description)
                .videoUrl(videoUrl).thumbnailUrl(thumbnailUrl)
                .isClip(isClip).durationSeconds(durationSeconds)
                .build();

        MediaItem saved = mediaRepo.save(item);
        String notifType = isClip ? "CLIP" : "MEDIA";

        notifService.notifyFollowers(authorId, notifType, saved.getId(), null,
                title != null ? title : (isClip ? "New clip" : "New video"));

        return toDTO(saved, authorId);
    }


    public List<MediaItemDTO> search(String query, Long viewerId) {
        String q = "%" + query.toLowerCase() + "%";
        return mediaRepo.searchByTitleOrDescription(q).stream().map(m -> toDTO(m, viewerId)).toList();
    }

    @Transactional
    public MediaItemDTO incrementViews(Long mediaId) {
        MediaItem m = mediaRepo.findById(mediaId).orElseThrow();
        m.setViewCount(m.getViewCount() + 1);
        return toDTO(mediaRepo.save(m), null);
    }

    @Transactional
    public MediaItemDTO vote(Long mediaId, Long userId, String voteType) {
        MediaItem media = mediaRepo.findById(mediaId).orElseThrow();
        Optional<MediaVote> existing = voteRepo.findByMediaIdAndUserId(mediaId, userId);

        if (existing.isPresent()) {
            MediaVote v = existing.get();
            if (v.getVoteType().equals(voteType)) {
                voteRepo.delete(v);
                if ("LIKE".equals(voteType)) media.setLikeCount(Math.max(0, media.getLikeCount() - 1));
                else media.setDislikeCount(Math.max(0, media.getDislikeCount() - 1));
            } else {
                if ("LIKE".equals(voteType)) {
                    media.setLikeCount(media.getLikeCount() + 1);
                    media.setDislikeCount(Math.max(0, media.getDislikeCount() - 1));
                } else {
                    media.setDislikeCount(media.getDislikeCount() + 1);
                    media.setLikeCount(Math.max(0, media.getLikeCount() - 1));
                }
                v.setVoteType(voteType);
                voteRepo.save(v);
            }
        } else {
            User user = userRepo.findById(userId).orElseThrow();
            voteRepo.save(MediaVote.builder().media(media).user(user).voteType(voteType).build());
            if ("LIKE".equals(voteType)) media.setLikeCount(media.getLikeCount() + 1);
            else media.setDislikeCount(media.getDislikeCount() + 1);
        }
        return toDTO(mediaRepo.save(media), userId);
    }

    public List<MediaItemDTO> getByAuthor(Long authorId, Long viewerId) {
        return mediaRepo.findByAuthorIdOrderByCreatedAtDesc(authorId)
                .stream().map(m -> toDTO(m, viewerId)).toList();
    }

    @Transactional
    @CacheEvict(value = "user-media", allEntries = true)
    public void delete(Long mediaId, Long userId) {
        MediaItem m = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Media item not found [mediaId=" + mediaId + "]"));

        if (!m.getAuthor().getId().equals(userId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your media item to delete");
        }

        voteRepo.deleteAllByMediaId(mediaId);
        mediaRepo.delete(m);
    }


    @Transactional
    @CacheEvict(value = "user-media", allEntries = true)
    public void adminDelete(Long mediaId) {
        MediaItem m = mediaRepo.findById(mediaId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Media item not found [mediaId=" + mediaId + "]"));

        voteRepo.deleteAllByMediaId(mediaId);
        mediaRepo.delete(m);
    }


    public MediaItemDTO toDTO(MediaItem m, Long viewerId) {
        String userVote = (viewerId != null)
                ? voteRepo.findByMediaIdAndUserId(m.getId(), viewerId).map(MediaVote::getVoteType).orElse(null)
                : null;
        User a = m.getAuthor();
        return MediaItemDTO.builder()
                .id(m.getId()).authorId(a.getId())
                .authorUsername(a.getUsername()).authorDisplayName(a.getDisplayName()).authorAvatar(a.getProfilePicture())
                .title(m.getTitle()).description(m.getDescription())
                .videoUrl(m.getVideoUrl()).thumbnailUrl(m.getThumbnailUrl())
                .likeCount(m.getLikeCount()).dislikeCount(m.getDislikeCount())
                .commentCount(m.getCommentCount()).viewCount(m.getViewCount())
                .userVote(userVote).isClip(m.isClip()).durationSeconds(m.getDurationSeconds())
                .createdAt(m.getCreatedAt()).build();
    }
}
