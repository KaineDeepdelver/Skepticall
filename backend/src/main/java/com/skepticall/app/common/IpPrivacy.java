package com.skepticall.app.common;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * Data minimisation for IP addresses: we only keep the network, not the exact address.
 * IPv4 keeps the first three numbers (a /24), IPv6 keeps the first three groups (a /48).
 * That is enough to notice a sign-in from somewhere new, and much less identifying.
 */
public final class IpPrivacy {

    private IpPrivacy() { }

    /** The masked network ("203.0.113.0", "2001:db8:1::"), or null if the input isn't an IP address. */
    public static String mask(String ip) {
        if (ip == null) return null;
        String s = ip.trim();
        if (s.isEmpty()) return null;
        try {
            if (s.matches("^\\d{1,3}(\\.\\d{1,3}){3}$")) {
                byte[] a = InetAddress.getByName(s).getAddress(); // literal address: no DNS lookup
                return (a[0] & 0xff) + "." + (a[1] & 0xff) + "." + (a[2] & 0xff) + ".0";
            }
            if (s.contains(":") && s.matches("^[0-9a-fA-F:.]+$")) {
                byte[] a = InetAddress.getByName(s).getAddress();
                if (a.length == 4) { // an IPv4 address written in IPv6 form
                    return (a[0] & 0xff) + "." + (a[1] & 0xff) + "." + (a[2] & 0xff) + ".0";
                }
                return String.format("%x:%x:%x::", ((a[0] & 0xff) << 8) | (a[1] & 0xff),
                        ((a[2] & 0xff) << 8) | (a[3] & 0xff), ((a[4] & 0xff) << 8) | (a[5] & 0xff));
            }
        } catch (UnknownHostException ignored) {
            // fall through
        }
        return null;
    }
}
