package com.blog.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
public class BlogRequest {

    @NotBlank
    @Size(min = 5, max = 150)
    private String title;

    @NotBlank
    @Size(min = 10, max = 300)
    private String summary;

    @NotBlank
    private String content;

    @NotBlank
    private String categoryName;

    private Set<String> tags = new HashSet<>();
}
