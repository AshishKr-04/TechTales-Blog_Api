package com.blog.api.repository;

import com.blog.api.entity.Blog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BlogRepository extends JpaRepository<Blog, Long> {

    @Query("SELECT DISTINCT b FROM Blog b LEFT JOIN b.tags t WHERE " +
           "(:keyword IS NULL OR b.title LIKE :keyword OR b.content LIKE :keyword) AND " +
           "(:category IS NULL OR b.category.name = :category) AND " +
           "(:tag IS NULL OR t.name = :tag)")
    Page<Blog> findByFilters(@Param("keyword") String keyword,
                             @Param("category") String category,
                             @Param("tag") String tag,
                             Pageable pageable);

    Page<Blog> findByAuthorId(Long authorId, Pageable pageable);

    long countByAuthorId(Long authorId);

    @Query("SELECT COUNT(l) FROM Blog b JOIN b.likedByUsers l WHERE b.author.id = :authorId")
    long countTotalLikesReceivedByAuthor(@Param("authorId") Long authorId);
}
