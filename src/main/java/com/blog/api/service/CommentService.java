package com.blog.api.service;

import com.blog.api.dto.CommentRequest;
import com.blog.api.dto.CommentResponse;
import com.blog.api.entity.Blog;
import com.blog.api.entity.Comment;
import com.blog.api.entity.User;
import com.blog.api.exception.ResourceNotFoundException;
import com.blog.api.repository.BlogRepository;
import com.blog.api.repository.CommentRepository;
import com.blog.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private BlogRepository blogRepository;

    @Autowired
    private UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByBlogId(Long blogId) {
        if (!blogRepository.existsById(blogId)) {
            throw new ResourceNotFoundException("Blog not found with id: " + blogId);
        }

        List<Comment> comments = commentRepository.findByBlogIdOrderByCreatedAtDesc(blogId);
        return comments.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CommentResponse addComment(Long blogId, CommentRequest request, String authorUsername) {
        Blog blog = blogRepository.findById(blogId)
                .orElseThrow(() -> new ResourceNotFoundException("Blog not found with id: " + blogId));

        User author = userRepository.findByUsername(authorUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + authorUsername));

        Comment comment = Comment.builder()
                .content(request.getContent())
                .blog(blog)
                .author(author)
                .build();

        Comment savedComment = commentRepository.save(comment);
        return mapToResponse(savedComment);
    }

    @Transactional
    public void deleteComment(Long commentId, String authorUsername) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with id: " + commentId));

        // Relational moderating check:
        // Either the author of the comment OR the author of the blog post can delete a comment!
        boolean isCommentAuthor = comment.getAuthor().getUsername().equals(authorUsername);
        boolean isBlogAuthor = comment.getBlog().getAuthor().getUsername().equals(authorUsername);

        if (!isCommentAuthor && !isBlogAuthor) {
            throw new AccessDeniedException("You do not have permission to delete this comment!");
        }

        commentRepository.delete(comment);
    }

    private CommentResponse mapToResponse(Comment comment) {
        return CommentResponse.builder()
                .id(comment.getId())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .authorId(comment.getAuthor().getId())
                .authorUsername(comment.getAuthor().getUsername())
                .build();
    }
}
