package com.blog.api.controller;

import com.blog.api.dto.CommentRequest;
import com.blog.api.dto.CommentResponse;
import com.blog.api.dto.MessageResponse;
import com.blog.api.service.CommentService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CommentController {

    @Autowired
    private CommentService commentService;

    @GetMapping("/blogs/{blogId}/comments")
    public ResponseEntity<List<CommentResponse>> getCommentsByBlogId(@PathVariable Long blogId) {
        return ResponseEntity.ok(commentService.getCommentsByBlogId(blogId));
    }

    @PostMapping("/blogs/{blogId}/comments")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long blogId,
            @Valid @RequestBody CommentRequest request) {
        
        return ResponseEntity.ok(commentService.addComment(blogId, request, getCurrentUsername()));
    }

    @DeleteMapping("/comments/{id}")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> deleteComment(@PathVariable Long id) {
        commentService.deleteComment(id, getCurrentUsername());
        return ResponseEntity.ok(new MessageResponse("Comment deleted successfully!"));
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth.getPrincipal() instanceof String)) {
            return auth.getName();
        }
        return null;
    }
}
