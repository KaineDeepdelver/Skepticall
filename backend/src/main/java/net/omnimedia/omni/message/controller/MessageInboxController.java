package net.omnimedia.omni.message.controller;

import jakarta.servlet.http.HttpServletRequest;
import net.omnimedia.omni.message.dto.MessageDTO;
import net.omnimedia.omni.message.service.MessageRetentionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** GET /messages/inbox: direct messages waiting for the caller's device to collect (then ack). */
@RestController
@RequestMapping("/messages")
@CrossOrigin(origins = "*")
public class MessageInboxController {

    @Autowired private MessageRetentionService retention;

    @GetMapping("/inbox")
    public List<MessageDTO> inbox(HttpServletRequest req) {
        Long me = (Long) req.getAttribute("authenticatedUserId");
        return retention.inboxFor(me);
    }
}
