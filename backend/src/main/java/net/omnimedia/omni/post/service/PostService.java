package net.omnimedia.omni.post.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.post.dto.PostDTO;
import net.omnimedia.omni.post.dto.PostMediaDTO;
import net.omnimedia.omni.post.entity.Post;
import net.omnimedia.omni.post.entity.PostMedia;
import net.omnimedia.omni.post.entity.PostVote;
import net.omnimedia.omni.post.repository.PostMediaRepository;
import net.omnimedia.omni.post.repository.PostRepository;
import net.omnimedia.omni.post.repository.PostVoteRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.notification.service.NotificationService;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service @RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepo;
    private final PostVoteRepository voteRepo;
    private final PostMediaRepository mediaRepo;
    private final UserRepository userRepo;
    private final NotificationService notifService;

    // == Slug generation =====================================================================
    private static final Pattern NON_ALPHANUM = Pattern.compile("[^a-z0-9]+");

    /** Derives a slug from the title (if present), then appends a short random suffix. */
    private String generateSlug(String title) {
        String base;
        if (title != null && !title.isBlank()) {
            // Normalize unicode → ASCII, lowercase, strip non-alphanumeric, collapse hyphens
            String normalized = Normalizer.normalize(title.trim(), Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", ""); // strip diacritics
            base = NON_ALPHANUM.matcher(normalized.toLowerCase()).replaceAll("-");
            // Trim trailing/leading hyphens and cap length
            base = base.replaceAll("^-+|-+$", "");
            if (base.length() > 48) base = base.substring(0, 48).replaceAll("-+$", "");
            if (base.isBlank()) base = "post";
        } else {
            base = "post";
        }
        // Append 8-char random suffix for uniqueness
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return base + "-" + suffix;
    }

    public List<PostDTO> getFeed(int page, int size, Long viewerId) {
        return postRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(p -> toDTO(p, viewerId)).toList();
    }

    @Cacheable(value = "user-posts", key = "#authorId + ':' + #page")
    public List<PostDTO> getUserPosts(Long authorId, int page, int size, Long viewerId) {
        return postRepo.findByAuthorIdOrderByCreatedAtDesc(authorId, PageRequest.of(page, size))
                .map(p -> toDTO(p, viewerId)).toList();
    }

    // == Fetch by slug (public URL) ===========================================================
    public PostDTO getBySlug(String slug, Long viewerId) {
        Post post = postRepo.findBySlug(slug)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Post not found [slug=" + slug + "]"));
        return toDTO(post, viewerId);
    }


    @Transactional
    @CacheEvict(value = "user-posts", key = "#authorId + ':0'")
    public PostDTO create(Long authorId, String title, String content, List<String[]> mediaEntries) {
        User author = userRepo.findById(authorId).orElseThrow();
        Post post = Post.builder()
                .author(author)
                .slug(generateSlug(title))
                .title(title)
                .content(content)
                .build();
        post = postRepo.save(post);

        if (mediaEntries != null) {
            for (int i = 0; i < mediaEntries.size(); i++) {
                String[] entry = mediaEntries.get(i);
                PostMedia pm = PostMedia.builder()
                        .post(post)
                        .mediaType(entry[0])
                        .mediaUrl(entry[1])
                        .position(i)
                        .build();
                post.getMediaItems().add(mediaRepo.save(pm));
            }
        }

        PostDTO dto = toDTO(post, authorId);
        notifService.notifyFollowers(authorId, "POST", post.getId(), post.getSlug(), title != null ? title : "New post");
        return dto;
    }

    public List<PostDTO> search(String query, Long viewerId) {
        String q = "%" + query.toLowerCase() + "%";
        return postRepo.searchByContent(q).stream().map(p -> toDTO(p, viewerId)).toList();
    }

    @Transactional
    public PostDTO vote(Long postId, Long userId, String voteType) {
        Post post = postRepo.findById(postId).orElseThrow();
        Optional<PostVote> existing = voteRepo.findByPostIdAndUserId(postId, userId);

        if (existing.isPresent()) {
            PostVote v = existing.get();
            if (v.getVoteType().equals(voteType)) {
                voteRepo.delete(v);
                if ("LIKE".equals(voteType)) post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
                else post.setDislikeCount(Math.max(0, post.getDislikeCount() - 1));
            } else {
                if ("LIKE".equals(voteType)) {
                    post.setLikeCount(post.getLikeCount() + 1);
                    post.setDislikeCount(Math.max(0, post.getDislikeCount() - 1));
                } else {
                    post.setDislikeCount(post.getDislikeCount() + 1);
                    post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
                }
                v.setVoteType(voteType);
                voteRepo.save(v);
            }
        } else {
            User user = userRepo.findById(userId).orElseThrow();
            voteRepo.save(PostVote.builder().post(post).user(user).voteType(voteType).build());
            if ("LIKE".equals(voteType)) post.setLikeCount(post.getLikeCount() + 1);
            else post.setDislikeCount(post.getDislikeCount() + 1);
        }
        return toDTO(postRepo.save(post), userId);
    }

    @Transactional
    @CacheEvict(value = "user-posts", allEntries = true)
    public void delete(Long postId, Long userId) {
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Post not found [postId=" + postId + "]"));

        if (!post.getAuthor().getId().equals(userId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your post to delete");
        }

        voteRepo.deleteAllByPostId(postId);
        postRepo.delete(post);
    }

    @Transactional
    @CacheEvict(value = "user-posts", allEntries = true)
    public void adminDelete(Long postId) {
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Post not found [postId=" + postId + "]"));

        voteRepo.deleteAllByPostId(postId);
        postRepo.delete(post);
    }


    public PostDTO toDTO(Post p, Long viewerId) {
        String userVote = null;
        if (viewerId != null)
            userVote = voteRepo.findByPostIdAndUserId(p.getId(), viewerId)
                    .map(PostVote::getVoteType).orElse(null);
        User a = p.getAuthor();

        List<PostMediaDTO> mediaDTOs = p.getMediaItems().stream()
                .map(m -> PostMediaDTO.builder()
                        .id(m.getId())
                        .mediaType(m.getMediaType())
                        .mediaUrl(m.getMediaUrl())
                        .position(m.getPosition())
                        .build())
                .toList();

        return PostDTO.builder()
                .id(p.getId())
                .slug(p.getSlug())
                .authorId(a.getId())
                .authorUsername(a.getUsername())
                .authorDisplayName(a.getDisplayName())
                .authorAvatar(a.getProfilePicture())
                .title(p.getTitle())
                .content(p.getContent())
                .mediaItems(mediaDTOs)
                .likeCount(p.getLikeCount())
                .dislikeCount(p.getDislikeCount())
                .commentCount(p.getCommentCount())
                .userVote(userVote)
                .createdAt(p.getCreatedAt())
                .build();
    }
}
