package net.omnimedia.omni.network.entity;

/**
 * Bitmask permissions for a NetworkRole. Stored as a single long on the role
 * (see NetworkRole#permissions); a member's effective permissions are the
 * bitwise OR of every role they hold. The network owner bypasses this
 * entirely and is always treated as having every permission — see
 * NetworkPermissionService.
 */
public enum NetworkPermission {
    MANAGE_NETWORK(1L),          // rename, change icon, delete network
    MANAGE_CHANNELS(1L << 1),    // create/rename/delete/reorder channels
    MANAGE_ROLES(1L << 2),       // create/edit/delete/assign roles (subject to hierarchy)
    KICK_MEMBERS(1L << 3),
    BAN_MEMBERS(1L << 4),
    POST_IN_ANNOUNCEMENTS(1L << 5),
    MANAGE_MESSAGES(1L << 6),    // delete/pin other members' messages
    CONNECT_VOICE(1L << 7),
    MUTE_MEMBERS(1L << 8);       // voice — mute/deafen others

    private final long bit;

    NetworkPermission(long bit) {
        this.bit = bit;
    }

    public long bit() {
        return bit;
    }

    public boolean isSetIn(long mask) {
        return (mask & bit) != 0;
    }

    // Sensible starting permission set for the auto-created @everyone role.
    public static long defaultMask() {
        return CONNECT_VOICE.bit();
    }
}
