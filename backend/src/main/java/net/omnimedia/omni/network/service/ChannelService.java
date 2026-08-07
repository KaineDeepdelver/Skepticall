package net.omnimedia.omni.network.service;

import lombok.RequiredArgsConstructor;
import net.omnimedia.omni.exceptions.BusinessException;
import net.omnimedia.omni.exceptions.ErrorType;
import net.omnimedia.omni.network.dto.ChannelDTO;
import net.omnimedia.omni.network.dto.ChannelMessageDTO;
import net.omnimedia.omni.network.entity.Channel;
import net.omnimedia.omni.network.entity.ChannelCategory;
import net.omnimedia.omni.network.entity.Network;
import net.omnimedia.omni.network.entity.NetworkMember;
import net.omnimedia.omni.network.entity.NetworkPermission;
import net.omnimedia.omni.network.entity.ChannelMessage;
import net.omnimedia.omni.network.entity.NetworkRole;
import net.omnimedia.omni.network.repository.ChannelCategoryRepository;
import net.omnimedia.omni.network.repository.ChannelMessageRepository;
import net.omnimedia.omni.network.repository.ChannelRepository;
import net.omnimedia.omni.network.repository.NetworkMemberRepository;
import net.omnimedia.omni.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final ChannelCategoryRepository channelCategoryRepository;
    private final ChannelMessageRepository channelMessageRepository;
    private final NetworkService networkService;
    private final NetworkPermissionService permissions;
    private final NetworkMemberRepository networkMemberRepository;

    // ── Channel CRUD ──────────────────────────────────────────────────

    @Transactional
    public ChannelDTO createChannel(Long networkId, Long requesterId, String name, Channel.Type type, Integer position, Long categoryId) {
        Network network = networkService.requireNetwork(networkId);
        NetworkMember requester = networkService.requireMember(network, requesterId);
        requireManageChannels(network, requester);

        ChannelCategory category = categoryId != null ? requireCategory(network, categoryId) : null;
        int pos = position != null ? position : channelRepository.findByNetworkIdOrderByPositionAsc(networkId).size();
        Channel channel = channelRepository.save(Channel.builder()
                .network(network)
                .category(category)
                .name(name.trim())
                .type(type)
                .position(pos)
                .build());
        return toDTO(channel);
    }

    @Transactional
    public ChannelDTO moveToCategory(Long networkId, Long requesterId, Long channelId, Long categoryId) {
        Network network = networkService.requireNetwork(networkId);
        NetworkMember requester = networkService.requireMember(network, requesterId);
        requireManageChannels(network, requester);

        Channel channel = requireChannel(network, channelId);
        channel.setCategory(categoryId != null ? requireCategory(network, categoryId) : null);
        return toDTO(channelRepository.save(channel));
    }

    private ChannelCategory requireCategory(Network network, Long categoryId) {
        ChannelCategory category = channelCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Category not found [categoryId=" + categoryId + "]"));
        if (!category.getNetwork().getId().equals(network.getId())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Category does not belong to this network");
        }
        return category;
    }

    @Transactional
    public ChannelDTO renameChannel(Long networkId, Long requesterId, Long channelId, String name) {
        Network network = networkService.requireNetwork(networkId);
        NetworkMember requester = networkService.requireMember(network, requesterId);
        requireManageChannels(network, requester);

        Channel channel = requireChannel(network, channelId);
        channel.setName(name.trim());
        return toDTO(channelRepository.save(channel));
    }

    @Transactional
    public void deleteChannel(Long networkId, Long requesterId, Long channelId) {
        Network network = networkService.requireNetwork(networkId);
        NetworkMember requester = networkService.requireMember(network, requesterId);
        requireManageChannels(network, requester);

        channelRepository.delete(requireChannel(network, channelId));
    }

    public List<ChannelDTO> listChannels(Long networkId, Long requesterId) {
        Network network = networkService.requireNetwork(networkId);
        networkService.requireMember(network, requesterId); // membership required to view
        return channelRepository.findByNetworkIdOrderByPositionAsc(networkId).stream().map(this::toDTO).toList();
    }

    // ── Messages ────────────────────────────────────────────────────────

    @Transactional
    public ChannelMessageDTO postMessage(Long networkId, Long channelId, Long senderId, String content, String fileUrl) {
        Network network = networkService.requireNetwork(networkId);
        NetworkMember sender = networkService.requireMember(network, senderId);
        Channel channel = requireChannel(network, channelId);

        if (channel.getType() == Channel.Type.ANNOUNCEMENT
                && !permissions.hasPermission(network, sender, NetworkPermission.POST_IN_ANNOUNCEMENTS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing POST_IN_ANNOUNCEMENTS permission");
        }
        if (channel.getType() == Channel.Type.VOICE) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Can't post text messages in a voice channel");
        }

        ChannelMessage msg = ChannelMessage.builder()
                .channel(channel)
                .author(sender.getUser())
                .content(content)
                .fileUrl(fileUrl)
                .build();
        return toMessageDTO(channelMessageRepository.save(msg));
    }

    public Page<ChannelMessageDTO> getMessages(Long networkId, Long requesterId, Long channelId, int page, int size) {
        Network network = networkService.requireNetwork(networkId);
        networkService.requireMember(network, requesterId);
        requireChannel(network, channelId);

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return channelMessageRepository.findByChannelIdOrderByCreatedAtDesc(channelId, pageRequest)
                .map(this::toMessageDTO);
    }

    @Transactional
    public ChannelMessageDTO editMessage(Long networkId, Long requesterId, Long messageId, String content) {
        Network network = networkService.requireNetwork(networkId);
        ChannelMessage msg = requireMessage(messageId);

        if (!msg.getAuthor().getId().equals(requesterId)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Only the author can edit this message");
        }
        msg.setContent(content);
        msg.setEdited(true);
        return toMessageDTO(channelMessageRepository.save(msg));
    }

    @Transactional
    public void deleteMessage(Long networkId, Long requesterId, Long messageId) {
        Network network = networkService.requireNetwork(networkId);
        ChannelMessage msg = requireMessage(messageId);

        boolean isAuthor = msg.getAuthor().getId().equals(requesterId);
        if (!isAuthor) {
            NetworkMember requester = networkService.requireMember(network, requesterId);
            NetworkMember author = networkService.requireMember(network, msg.getAuthor().getId());
            boolean canModerate = permissions.hasPermission(network, requester, NetworkPermission.MANAGE_MESSAGES)
                    && permissions.canActOnMember(network, requester, author);
            if (!canModerate) {
                throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_MESSAGES permission, or author outranks you");
            }
        }
        channelMessageRepository.delete(msg);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private void requireManageChannels(Network network, NetworkMember requester) {
        if (!permissions.hasPermission(network, requester, NetworkPermission.MANAGE_CHANNELS)) {
            throw new BusinessException(ErrorType.PERMISSION_DENIED, "Missing MANAGE_CHANNELS permission");
        }
    }

    private Channel requireChannel(Network network, Long channelId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Channel not found [channelId=" + channelId + "]"));
        if (!channel.getNetwork().getId().equals(network.getId())) {
            throw new BusinessException(ErrorType.INVALID_OPERATION, "Channel does not belong to this network");
        }
        return channel;
    }

    private ChannelMessage requireMessage(Long messageId) {
        return channelMessageRepository.findById(messageId)
                .orElseThrow(() -> new BusinessException(ErrorType.NOT_FOUND, "Message not found [messageId=" + messageId + "]"));
    }

    private ChannelDTO toDTO(Channel c) {
        return ChannelDTO.builder()
                .id(c.getId())
                .networkId(c.getNetwork().getId())
                .categoryId(c.getCategory() != null ? c.getCategory().getId() : null)
                .name(c.getName())
                .type(c.getType().name())
                .position(c.getPosition())
                .build();
    }

    private ChannelMessageDTO toMessageDTO(ChannelMessage m) {
        User author = m.getAuthor();
        String roleColor = networkMemberRepository
                .findByNetworkIdAndUserId(m.getChannel().getNetwork().getId(), author.getId())
                .map(this::topRoleColor)
                .orElse(null);
        return ChannelMessageDTO.builder()
                .id(m.getId())
                .channelId(m.getChannel().getId())
                .authorId(author.getId())
                .authorUsername(author.getUsername())
                .authorDisplayName(author.getDisplayName())
                .authorAvatar(author.getProfilePicture())
                .authorRoleColor(roleColor)
                .content(m.getContent())
                .fileUrl(m.getFileUrl())
                .edited(m.getEdited())
                .createdAt(m.getCreatedAt())
                .build();
    }

    // Members use the colour of the highest-position role they hold that
    // actually has a colour set — roles with no colour (or the default
    // @everyone role, which is never given one) are skipped so they don't
    // mask a lower role's colour.
    private String topRoleColor(NetworkMember member) {
        return member.getRoles().stream()
                .filter(r -> r.getColor() != null && !r.getColor().isBlank())
                .max(Comparator.comparingInt(NetworkRole::getPosition))
                .map(NetworkRole::getColor)
                .orElse(null);
    }
}
