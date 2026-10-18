package com.skepticall.app.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IpPrivacyTest {

    @Test
    void ipv4KeepsOnlyTheNetwork() {
        assertEquals("203.0.113.0", IpPrivacy.mask("203.0.113.77"));
        assertEquals("10.1.2.0", IpPrivacy.mask(" 10.1.2.3 "));
    }

    @Test
    void ipv6KeepsOnlyTheFirstThreeGroups() {
        assertEquals("2001:db8:1::", IpPrivacy.mask("2001:db8:1:2:3:4:5:6"));
        assertEquals("2001:db8:0::", IpPrivacy.mask("2001:db8::1"));
    }

    @Test
    void anIpv4AddressWrittenAsIpv6IsMaskedLikeIpv4() {
        assertEquals("203.0.113.0", IpPrivacy.mask("::ffff:203.0.113.77"));
    }

    @Test
    void twoAddressesOnTheSameNetworkLookTheSame() {
        assertEquals(IpPrivacy.mask("198.51.100.4"), IpPrivacy.mask("198.51.100.250"));
        assertNotEquals(IpPrivacy.mask("198.51.100.4"), IpPrivacy.mask("198.51.101.4"));
    }

    @Test
    void anythingThatIsNotAnIpIsDropped() {
        assertNull(IpPrivacy.mask(null));
        assertNull(IpPrivacy.mask(""));
        assertNull(IpPrivacy.mask("localhost"));   // never triggers a DNS lookup
        assertNull(IpPrivacy.mask("example.com"));
        assertNull(IpPrivacy.mask("999.1.1.1x"));
    }
}
