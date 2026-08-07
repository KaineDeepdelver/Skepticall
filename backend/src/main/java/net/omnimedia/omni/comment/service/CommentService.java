package net.omnimedia.omni.comment.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.comment.dto.CommentDTO;
import net.omnimedia.omni.comment.entity.*;
import net.omnimedia.omni.comment.repository.*;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.media.repository.MediaItemRepository;
import net.omnimedia.omni.post.repository.PostRepository;
import net.omnimedia.omni.user.entity.User;
import net.omnimedia.omni.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class CommentService {
    private final CommentRepository commentRepo;
    private final CommentVoteRepository voteRepo;
    private final CommentReactionRepository reactionRepo;
    private final UserRepository userRepo;
    private final PostRepository postRepo;
    private final MediaItemRepository mediaRepo;

    public List<CommentDTO> getReplies(Long parentId, Long viewerId) {
        return commentRepo.findByParentIdOrderByCreatedAtAsc(parentId).stream()
                .map(c -> toDTO(c, viewerId)).toList();
    }

    @Transactional
    public CommentDTO addReply(Long parentId, Long authorId, String content) {
        Comment parent = commentRepo.findById(parentId).orElseThrow();
        User author = userRepo.findById(authorId).orElseThrow();
        Comment c = Comment.builder()
                .author(author)
                .postId(parent.getPostId())
                .mediaId(parent.getMediaId())
                .parentId(parentId)
                .content(content).build();
        return toDTO(commentRepo.save(c), authorId);
    }

    // Returns TOP-LEVEL comments only — replies are loaded separately via getReplies
    public List<CommentDTO> getForPost(Long postId, Long viewerId) {
        return commentRepo.findTopLevelByPostId(postId).stream()
                .map(c -> toDTO(c, viewerId)).toList();
    }

    public List<CommentDTO> getForMedia(Long mediaId, Long viewerId) {
        return commentRepo.findTopLevelByMediaId(mediaId).stream()
                .map(c -> toDTO(c, viewerId)).toList();
    }

    @Transactional
    public CommentDTO addToPost(Long postId, Long authorId, String content) {
        User author = userRepo.findById(authorId).orElseThrow();
        Comment c = Comment.builder().author(author).postId(postId).content(content).build();
        Comment saved = commentRepo.save(c);
        postRepo.findById(postId).ifPresent(p -> { p.setCommentCount(p.getCommentCount() + 1); postRepo.save(p); });
        return toDTO(saved, authorId);
    }

    @Transactional
    public CommentDTO addToMedia(Long mediaId, Long authorId, String content) {
        User author = userRepo.findById(authorId).orElseThrow();
        Comment c = Comment.builder().author(author).mediaId(mediaId).content(content).build();
        Comment saved = commentRepo.save(c);
        mediaRepo.findById(mediaId).ifPresent(m -> { m.setCommentCount(m.getCommentCount() + 1); mediaRepo.save(m); });
        return toDTO(saved, authorId);
    }

    @Transactional
    public CommentDTO vote(Long commentId, Long userId, String voteType) {
        Comment comment = commentRepo.findById(commentId).orElseThrow();
        Optional<CommentVote> existing = voteRepo.findByCommentIdAndUserId(commentId, userId);
        if (existing.isPresent()) {
            CommentVote v = existing.get();
            if (v.getVoteType().equals(voteType)) {
                voteRepo.delete(v);
                if ("LIKE".equals(voteType)) comment.setLikeCount(Math.max(0, comment.getLikeCount() - 1));
                else comment.setDislikeCount(Math.max(0, comment.getDislikeCount() - 1));
            } else {
                if ("LIKE".equals(voteType)) { comment.setLikeCount(comment.getLikeCount() + 1); comment.setDislikeCount(Math.max(0, comment.getDislikeCount() - 1)); }
                else { comment.setDislikeCount(comment.getDislikeCount() + 1); comment.setLikeCount(Math.max(0, comment.getLikeCount() - 1)); }
                v.setVoteType(voteType); voteRepo.save(v);
            }
        } else {
            User user = userRepo.findById(userId).orElseThrow();
            voteRepo.save(CommentVote.builder().comment(comment).user(user).voteType(voteType).build());
            if ("LIKE".equals(voteType)) comment.setLikeCount(comment.getLikeCount() + 1);
            else comment.setDislikeCount(comment.getDislikeCount() + 1);
        }
        return toDTO(commentRepo.save(comment), userId);
    }

    @Transactional
    public CommentDTO toggleReaction(Long commentId, Long userId, String emoji) {
        Comment comment = commentRepo.findById(commentId).orElseThrow();
        Optional<CommentReaction> existing = reactionRepo.findByCommentIdAndUserIdAndEmoji(commentId, userId, emoji);
        if (existing.isPresent()) reactionRepo.delete(existing.get());
        else {
            User user = userRepo.findById(userId).orElseThrow();
            reactionRepo.save(CommentReaction.builder().comment(comment).user(user).emoji(emoji).build());
        }
        return toDTO(comment, userId);
    }

    @Transactional
    public void delete(Long commentId, Long userId) {
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Comment not found [commentId=" + commentId + "]"));

        if (!comment.getAuthor().getId().equals(userId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Not your comment to delete");
        }

        // Delete all replies first (cleaning up their votes/reactions too), then this comment's own
        commentRepo.findByParentIdOrderByCreatedAtAsc(commentId).forEach(reply -> {
            voteRepo.deleteAllByCommentId(reply.getId());
            reactionRepo.deleteAllByCommentId(reply.getId());
            commentRepo.delete(reply);
        });
        voteRepo.deleteAllByCommentId(commentId);
        reactionRepo.deleteAllByCommentId(commentId);
        commentRepo.delete(comment);
    }

    // == Admin delete — bypasses ownership check entirely =============================================
    @Transactional
    public void adminDelete(Long commentId) {
        Comment comment = commentRepo.findById(commentId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Comment not found [commentId=" + commentId + "]"));

        // Delete all replies first (cleaning up their votes/reactions too), then this comment's own
        commentRepo.findByParentIdOrderByCreatedAtAsc(commentId).forEach(reply -> {
            voteRepo.deleteAllByCommentId(reply.getId());
            reactionRepo.deleteAllByCommentId(reply.getId());
            commentRepo.delete(reply);
        });
        voteRepo.deleteAllByCommentId(commentId);
        reactionRepo.deleteAllByCommentId(commentId);
        commentRepo.delete(comment);
    }


    private CommentDTO toDTO(Comment c, Long viewerId) {
        String userVote = (viewerId != null)
                ? voteRepo.findByCommentIdAndUserId(c.getId(), viewerId).map(CommentVote::getVoteType).orElse(null)
                : null;

        Map<String, Long> reactions = reactionRepo.countByEmoji(c.getId()).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));

        List<String> userReactions = (viewerId != null)
                ? reactionRepo.findByCommentIdAndUserId(c.getId(), viewerId).stream().map(CommentReaction::getEmoji).toList()
                : List.of();

        int replyCount = (int) commentRepo.countByParentId(c.getId());

        User a = c.getAuthor();
        return CommentDTO.builder()
                .id(c.getId()).authorId(a.getId())
                .authorUsername(a.getUsername()).authorDisplayName(a.getDisplayName()).authorAvatar(a.getProfilePicture())
                .postId(c.getPostId()).mediaId(c.getMediaId()).parentId(c.getParentId())
                .content(c.getContent())
                .likeCount(c.getLikeCount()).dislikeCount(c.getDislikeCount())
                .userVote(userVote).reactions(reactions).userReactions(userReactions)
                .createdAt(c.getCreatedAt())
                .replyCount(replyCount)
                .build();
    }
}
