package com.blog.api.controller;

import com.blog.api.dto.BlogRequest;
import com.blog.api.dto.BlogResponse;
import com.blog.api.dto.MessageResponse;
import com.blog.api.service.BlogService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/blogs")
public class BlogController {

    @Autowired
    private BlogService blogService;

    @GetMapping
    public ResponseEntity<Page<BlogResponse>> getAllBlogs(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {
        
        return ResponseEntity.ok(blogService.getAllBlogs(keyword, category, tag, page, size, getCurrentUsername()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BlogResponse> getBlogById(@PathVariable Long id) {
        return ResponseEntity.ok(blogService.getBlogById(id, getCurrentUsername()));
    }

    @GetMapping("/author/{authorId}")
    public ResponseEntity<Page<BlogResponse>> getBlogsByAuthor(
            @PathVariable Long authorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {
        
        return ResponseEntity.ok(blogService.getBlogsByAuthor(authorId, page, size, getCurrentUsername()));
    }

    @PostMapping
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<BlogResponse> createBlog(@Valid @RequestBody BlogRequest request) {
        return ResponseEntity.ok(blogService.createBlog(request, getCurrentUsername()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<BlogResponse> updateBlog(@PathVariable Long id, @Valid @RequestBody BlogRequest request) {
        return ResponseEntity.ok(blogService.updateBlog(id, request, getCurrentUsername()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> deleteBlog(@PathVariable Long id) {
        blogService.deleteBlog(id, getCurrentUsername());
        return ResponseEntity.ok(new MessageResponse("Blog deleted successfully!"));
    }

    @PostMapping("/{id}/like")
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public ResponseEntity<BlogResponse> toggleLike(@PathVariable Long id) {
        return ResponseEntity.ok(blogService.toggleLike(id, getCurrentUsername()));
    }

    private String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth.getPrincipal() instanceof String)) {
            return auth.getName();
        }
        return null;
    }
}
