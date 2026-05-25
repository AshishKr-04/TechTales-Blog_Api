package com.blog.api.service;

import com.blog.api.dto.BlogRequest;
import com.blog.api.dto.BlogResponse;
import com.blog.api.entity.Blog;
import com.blog.api.entity.Category;
import com.blog.api.entity.Tag;
import com.blog.api.entity.User;
import com.blog.api.exception.ResourceNotFoundException;
import com.blog.api.repository.BlogRepository;
import com.blog.api.repository.CategoryRepository;
import com.blog.api.repository.TagRepository;
import com.blog.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class BlogService {

    @Autowired
    private BlogRepository blogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private TagRepository tagRepository;

    @Transactional(readOnly = true)
    public Page<BlogResponse> getAllBlogs(String keyword, String category, String tag, int page, int size, String currentUsername) {
        // Sort by creation date descending (newest first)
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        
        // Normalize empty filters and prepare lowercase search criteria for Hibernate 6
        String normalizedKeyword = (keyword != null && !keyword.trim().isEmpty()) ? "%" + keyword.trim().toLowerCase() + "%" : null;
        String normalizedCategory = (category != null && !category.trim().isEmpty()) ? category.trim().toLowerCase() : null;
        String normalizedTag = (tag != null && !tag.trim().isEmpty()) ? tag.trim().toLowerCase() : null;

        Page<Blog> blogs = blogRepository.findByFilters(normalizedKeyword, normalizedCategory, normalizedTag, pageable);
        return blogs.map(blog -> mapToResponse(blog, currentUsername));
    }

    @Transactional(readOnly = true)
    public Page<BlogResponse> getBlogsByAuthor(Long authorId, int page, int size, String currentUsername) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Blog> blogs = blogRepository.findByAuthorId(authorId, pageable);
        return blogs.map(blog -> mapToResponse(blog, currentUsername));
    }

    @Transactional(readOnly = true)
    public BlogResponse getBlogById(Long id, String currentUsername) {
        Blog blog = blogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Blog not found with id: " + id));
        return mapToResponse(blog, currentUsername);
    }

    @Transactional
    public BlogResponse createBlog(BlogRequest request, String authorUsername) {
        User author = userRepository.findByUsername(authorUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + authorUsername));

        Category category = resolveCategory(request.getCategoryName());
        Set<Tag> tags = resolveTags(request.getTags());

        Blog blog = Blog.builder()
                .title(request.getTitle())
                .summary(request.getSummary())
                .content(request.getContent())
                .author(author)
                .category(category)
                .tags(tags)
                .build();

        Blog savedBlog = blogRepository.save(blog);
        return mapToResponse(savedBlog, authorUsername);
    }

    @Transactional
    public BlogResponse updateBlog(Long id, BlogRequest request, String authorUsername) {
        Blog blog = blogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Blog not found with id: " + id));

        // Validate Ownership
        if (!blog.getAuthor().getUsername().equals(authorUsername)) {
            throw new AccessDeniedException("You do not have permission to edit this blog!");
        }

        Category category = resolveCategory(request.getCategoryName());
        Set<Tag> tags = resolveTags(request.getTags());

        blog.setTitle(request.getTitle());
        blog.setSummary(request.getSummary());
        blog.setContent(request.getContent());
        blog.setCategory(category);
        blog.setTags(tags);

        Blog updatedBlog = blogRepository.save(blog);
        return mapToResponse(updatedBlog, authorUsername);
    }

    @Transactional
    public void deleteBlog(Long id, String authorUsername) {
        Blog blog = blogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Blog not found with id: " + id));

        // Validate Ownership
        if (!blog.getAuthor().getUsername().equals(authorUsername)) {
            throw new AccessDeniedException("You do not have permission to delete this blog!");
        }

        blogRepository.delete(blog);
    }

    @Transactional
    public BlogResponse toggleLike(Long id, String username) {
        Blog blog = blogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Blog not found with id: " + id));

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username: " + username));

        boolean removed = blog.getLikedByUsers().removeIf(u -> u.getId().equals(user.getId()));
        if (!removed) {
            blog.getLikedByUsers().add(user);
        }

        Blog savedBlog = blogRepository.save(blog);
        return mapToResponse(savedBlog, username);
    }

    private Category resolveCategory(String categoryName) {
        if (categoryName == null || categoryName.trim().isEmpty()) {
            categoryName = "General";
        }
        final String finalName = categoryName.trim();
        return categoryRepository.findByName(finalName)
                .orElseGet(() -> categoryRepository.save(Category.builder()
                        .name(finalName)
                        .description("Category automatically created upon blog publishing")
                        .build()));
    }

    private Set<Tag> resolveTags(Set<String> tagNames) {
        Set<Tag> tags = new HashSet<>();
        if (tagNames != null) {
            for (String name : tagNames) {
                if (name == null || name.trim().isEmpty()) continue;
                final String finalName = name.trim();
                Tag tag = tagRepository.findByName(finalName)
                        .orElseGet(() -> tagRepository.save(Tag.builder()
                                .name(finalName)
                                .build()));
                tags.add(tag);
            }
        }
        return tags;
    }

    private BlogResponse mapToResponse(Blog blog, String currentUsername) {
        boolean likedByCurrentUser = false;
        if (currentUsername != null) {
            likedByCurrentUser = blog.getLikedByUsers().stream()
                    .anyMatch(u -> u.getUsername().equals(currentUsername));
        }

        Set<String> tags = blog.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toSet());

        return BlogResponse.builder()
                .id(blog.getId())
                .title(blog.getTitle())
                .summary(blog.getSummary())
                .content(blog.getContent())
                .createdAt(blog.getCreatedAt())
                .updatedAt(blog.getUpdatedAt())
                .authorId(blog.getAuthor().getId())
                .authorUsername(blog.getAuthor().getUsername())
                .categoryName(blog.getCategory() != null ? blog.getCategory().getName() : "General")
                .tags(tags)
                .likeCount(blog.getLikedByUsers().size())
                .likedByCurrentUser(likedByCurrentUser)
                .build();
    }
}
