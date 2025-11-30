import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || "https://monkfish-upright-lamb.ngrok-free.app";

export const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
        title: "Volshebny API",
        version: "1.0.0",
        description: "Документация API сервиса Volshebny (динамическая версия)",
    },
    servers: [
        {
            url: `http://localhost:${PORT}/api/v1/`,
            description: "Локальный dev сервер",
        },
        {
            url: `${BACKEND_URL}/api/v1/`,
            description: "Продакшн сервер",
        },
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "token",
                description: "JWT токен в cookie.",
            },
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT токен в заголовке Authorization",
            },
        },
        schemas: {
            User: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    fullname: { type: "string" },
                    username: { type: "string" },
                    email: { type: "string", format: "email" },
                    bio: { type: "string", nullable: true },
                    avatar: { type: "string", nullable: true },
                    interests: { type: "array", items: { type: "string" } },
                    tokens: { type: "integer" },
                    role: { type: "string", enum: ["user", "admin"] },
                    isBlocked: { type: "boolean" },
                    verified: { type: "boolean" },
                    replicateModels: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                name: { type: "string" },
                                status: { type: "string" }
                            }
                        }
                    },
                },
            },
            Publication: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    content: { type: "string" },
                    imageUrl: { type: "string", nullable: true },
                    videoUrl: { type: "string", nullable: true },
                    likeCount: { type: "integer" },
                    commentCount: { type: "integer" },
                    isPhotoOfTheDay: { type: "boolean" },
                    category: { type: "string", nullable: true },
                    author: { $ref: "#/components/schemas/User" },
                    isLiked: { type: "boolean", description: "Лайкнул ли текущий пользователь" },
                    isFollowing: { type: "boolean", description: "Подписан ли текущий пользователь на автора" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            Comment: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    text: { type: "string" },
                    userId: { type: "string", format: "uuid" },
                    publicationId: { type: "string", format: "uuid" },
                    parentId: { type: "string", format: "uuid", nullable: true },
                    likeCount: { type: "integer" },
                    isLiked: { type: "boolean" },
                    replies: { type: "array", items: { $ref: "#/components/schemas/Comment" } },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            GalleryItem: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid" },
                    userId: { type: "string", format: "uuid" },
                    prompt: { type: "string" },
                    imageUrl: { type: "string" },
                    generationType: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
            ApiResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: { nullable: true },
                },
            },
        },
    },
    security: [
        { cookieAuth: [] },
        { bearerAuth: [] },
    ],
    tags: [
        { name: "Auth", description: "Аутентификация" },
        { name: "Users", description: "Пользователи и подписки" },
        { name: "Publications", description: "Посты, лента, лайки" },
        { name: "Comments", description: "Комментарии" },
        { name: "Search", description: "Поиск по пользователям и постам" },
        { name: "Gallery", description: "Личная галерея" },
        { name: "AI - GPT", description: "Генерация изображений (GPT/DALL-E)" },
        { name: "AI - Nano", description: "Генерация изображений (Nano)" },
        { name: "AI - Kling", description: "Генерация видео (Kling)" },
        { name: "AI - Higgsfield", description: "Генерация видео (Higgsfield)" },
        { name: "AI - Replicate", description: "Тренировка моделей и генерация" },
        { name: "Admin", description: "Административная панель" },
    ],
    paths: {
        // --- AUTH ---
        "/auth/register-step-1": {
            post: {
                tags: ["Auth"],
                summary: "Шаг 1: Отправка OTP на email",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } }
                },
                responses: { "200": { description: "OTP отправлен" } }
            }
        },
        "/auth/register-step-2": {
            post: {
                tags: ["Auth"],
                summary: "Шаг 2: Проверка OTP",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["email", "otp"], properties: { email: { type: "string" }, otp: { type: "string" } } } } }
                },
                responses: { "200": { description: "Email подтвержден" } }
            }
        },
        "/auth/register-step-3": {
            post: {
                tags: ["Auth"],
                summary: "Шаг 3: Завершение регистрации",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["email", "fullname", "username", "password"], properties: { email: { type: "string" }, fullname: { type: "string" }, username: { type: "string" }, password: { type: "string" } } } } }
                },
                responses: { "201": { description: "Пользователь создан" } }
            }
        },
        "/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Вход в систему",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["usernameOrEmail", "password"], properties: { usernameOrEmail: { type: "string" }, password: { type: "string" } } } } }
                },
                responses: { "200": { description: "Успешный вход" } }
            }
        },
        "/auth/logout": {
            post: {
                tags: ["Auth"],
                summary: "Выход из системы",
                responses: { "200": { description: "Успешный выход" } }
            }
        },
        "/auth/me": {
            get: {
                tags: ["Auth"],
                summary: "Получить текущего пользователя",
                responses: { "200": { description: "Данные пользователя", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } }
            }
        },
        "/auth/forgot-password": {
            post: {
                tags: ["Auth"],
                summary: "Запрос на сброс пароля",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string" } } } } }
                },
                responses: { "200": { description: "Письмо отправлено" } }
            }
        },
        "/auth/reset-password/{token}": {
            post: {
                tags: ["Auth"],
                summary: "Установка нового пароля",
                parameters: [{ in: "path", name: "token", required: true, schema: { type: "string" } }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["password"], properties: { password: { type: "string" } } } } }
                },
                responses: { "200": { description: "Пароль изменен" } }
            }
        },

        // --- USERS ---
        "/users/search/users": {
            get: {
                tags: ["Users"],
                summary: "Поиск пользователей",
                parameters: [{ in: "query", name: "query", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Список пользователей" } }
            }
        },
        "/users/me/profile": {
            get: {
                tags: ["Users"],
                summary: "Профиль текущего пользователя (расширенный)",
                responses: { "200": { description: "Профиль" } }
            },
            put: {
                tags: ["Users"],
                summary: "Обновить профиль",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { fullname: { type: "string" }, bio: { type: "string" }, interests: { type: "array", items: { type: "string" } } } } } }
                },
                responses: { "200": { description: "Обновлено" } }
            }
        },
        "/users/me/avatar": {
            put: {
                tags: ["Users"],
                summary: "Обновить аватар",
                requestBody: {
                    content: { "multipart/form-data": { schema: { type: "object", properties: { avatar: { type: "string", format: "binary" } } } } }
                },
                responses: { "200": { description: "Аватар обновлен" } }
            }
        },
        "/users/me/profile/followers": {
            get: { tags: ["Users"], summary: "Мои подписчики", responses: { "200": { description: "Список подписчиков" } } }
        },
        "/users/me/profile/following": {
            get: { tags: ["Users"], summary: "Мои подписки", responses: { "200": { description: "Список подписок" } } }
        },
        "/users/users/recommendations": {
            get: {
                tags: ["Users"],
                summary: "Рекомендации пользователей",
                parameters: [{ in: "query", name: "limit", schema: { type: "integer", default: 10 } }],
                responses: { "200": { description: "Список рекомендованных пользователей" } }
            }
        },
        "/users/me/admin": {
            put: { tags: ["Users"], summary: "Стать админом (dev)", responses: { "200": { description: "Роль изменена" } } }
        },
        "/users/{username}": {
            get: {
                tags: ["Users"],
                summary: "Профиль пользователя по username",
                parameters: [{ in: "path", name: "username", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Профиль" } }
            }
        },
        "/users/{userId}/subscribe": {
            post: {
                tags: ["Users"],
                summary: "Подписаться",
                parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Успешно" } }
            }
        },
        "/users/{userId}/unsubscribe": {
            delete: {
                tags: ["Users"],
                summary: "Отписаться",
                parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Успешно" } }
            }
        },

        // --- SEARCH ---
        "/search": {
            get: {
                tags: ["Search"],
                summary: "Глобальный поиск",
                parameters: [
                    { in: "query", name: "query", schema: { type: "string" } },
                    { in: "query", name: "type", schema: { type: "string", enum: ["all", "users", "publications"], default: "all" } },
                    { in: "query", name: "sortBy", schema: { type: "string", enum: ["newest", "popular", "oldest"] } },
                    { in: "query", name: "hashtag", schema: { type: "string" } }
                ],
                responses: { "200": { description: "Результаты поиска" } }
            }
        },

        // --- PUBLICATIONS ---
        "/publications": {
            get: {
                tags: ["Publications"],
                summary: "Получить ленту",
                parameters: [
                    { in: "query", name: "page", schema: { type: "integer", default: 1 } },
                    { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
                    { in: "query", name: "sortBy", schema: { type: "string", enum: ["newest", "oldest", "popular"] } },
                    { in: "query", name: "hashtag", schema: { type: "string" } }
                ],
                responses: { "200": { description: "Лента", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Publication" } } } } } }
            },
            post: {
                tags: ["Publications"],
                summary: "Создать публикацию",
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    content: { type: "string" },
                                    publicationMedia: { type: "string", format: "binary" }
                                }
                            }
                        }
                    }
                },
                responses: { "201": { description: "Создано" } }
            }
        },
        "/publications/me/liked": {
            get: { tags: ["Publications"], summary: "Мои лайки", responses: { "200": { description: "Список" } } }
        },
        "/publications/{publicationId}": {
            get: {
                tags: ["Publications"],
                summary: "Получить публикацию по ID",
                parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Публикация" } }
            },
            put: {
                tags: ["Publications"],
                summary: "Обновить публикацию",
                parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }],
                requestBody: { content: { "application/json": { schema: { type: "object", properties: { content: { type: "string" } } } } } },
                responses: { "200": { description: "Обновлено" } }
            },
            delete: {
                tags: ["Publications"],
                summary: "Удалить публикацию",
                parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Удалено" } }
            }
        },
        "/publications/{publicationId}/like": {
            post: { tags: ["Publications"], parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Лайк поставлен" } } }
        },
        "/publications/{publicationId}/unlike": {
            delete: { tags: ["Publications"], parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Лайк убран" } } }
        },

        // --- COMMENTS ---
        "/comments/{publicationId}/comments": {
            get: { tags: ["Comments"], parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Комментарии" } } },
            post: { tags: ["Comments"], parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["text"], properties: { text: { type: "string" } } } } } }, responses: { "201": { description: "Создан" } } }
        },
        "/comments/{commentId}/reply": {
            post: { tags: ["Comments"], summary: "Ответ на комментарий", parameters: [{ in: "path", name: "commentId", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", required: ["text"], properties: { text: { type: "string" } } } } } }, responses: { "201": { description: "Ответ создан" } } }
        },
        "/comments/{commentId}": {
            put: { tags: ["Comments"], parameters: [{ in: "path", name: "commentId", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { text: { type: "string" } } } } } }, responses: { "200": { description: "Обновлено" } } },
            delete: { tags: ["Comments"], parameters: [{ in: "path", name: "commentId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Удалено" } } }
        },
        "/comments/{commentId}/like": {
            post: { tags: ["Comments"], parameters: [{ in: "path", name: "commentId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Лайк" } } }
        },
        "/comments/{commentId}/unlike": {
            delete: { tags: ["Comments"], parameters: [{ in: "path", name: "commentId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Лайк удален" } } }
        },

        // --- GALLERY ---
        "/gallery": {
            get: {
                tags: ["Gallery"],
                summary: "Моя галерея",
                parameters: [
                    { in: "query", name: "sortBy", schema: { type: "string", enum: ["newest", "oldest"] } },
                    { in: "query", name: "searchQuery", schema: { type: "string" } },
                    { in: "query", name: "date", schema: { type: "string", format: "date" } }
                ],
                responses: { "200": { description: "Элементы галереи" } }
            }
        },

        // --- AI ROUTES ---
        "/gpt/generate": {
            post: {
                tags: ["AI - GPT"],
                summary: "Генерация изображений (GPT)",
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["prompt"],
                                properties: {
                                    prompt: { type: "string" },
                                    publish: { type: "boolean" },
                                    // gpt routes use uploadGptImages middleware, so file upload is technically possible if extended
                                }
                            }
                        }
                    }
                },
                responses: { "200": { description: "Генерация успешна" } }
            }
        },
        "/nano/generate": {
            post: {
                tags: ["AI - Nano"],
                summary: "Генерация изображений (Nano Banana)",
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["prompt"],
                                properties: {
                                    prompt: { type: "string" },
                                    aspect_ratio: { type: "string", default: "1:1" },
                                    publish: { type: "boolean" },
                                    nanoImage: { type: "string", format: "binary", description: "Image to Image reference" }
                                }
                            }
                        }
                    }
                },
                responses: { "200": { description: "Генерация успешна" } }
            }
        },
        "/kling/generate": {
            post: {
                tags: ["AI - Kling"],
                summary: "Генерация видео (Kling)",
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["klingImage"],
                                properties: {
                                    klingImage: { type: "string", format: "binary", description: "Source image" },
                                    prompt: { type: "string" },
                                    duration: { type: "integer", default: 5 },
                                    aspect_ratio: { type: "string", default: "16:9" },
                                    negative_prompt: { type: "string" },
                                    effect: { type: "string" },
                                    publish: { type: "boolean" }
                                }
                            }
                        }
                    }
                },
                responses: { "200": { description: "Видео сгенерировано" } }
            }
        },
        "/higgsfield/generate": {
            post: {
                tags: ["AI - Higgsfield"],
                summary: "Генерация видео (Higgsfield)",
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["prompt", "motion_id", "higgsfieldImage"],
                                properties: {
                                    higgsfieldImage: { type: "array", items: { type: "string", format: "binary" }, description: "Start (and optional End) frame" },
                                    prompt: { type: "string" },
                                    motion_id: { type: "string" },
                                    model: { type: "string", enum: ["turbo", "standard", "lite"] },
                                    enhance_prompt: { type: "boolean" },
                                    seed: { type: "integer" },
                                    publish: { type: "boolean" }
                                }
                            }
                        }
                    }
                },
                responses: { "200": { description: "Видео сгенерировано" } }
            }
        },
        "/higgsfield/motions": {
            get: {
                tags: ["AI - Higgsfield"],
                summary: "Получить пресеты движений",
                parameters: [{ in: "query", name: "size", schema: { type: "integer" } }, { in: "query", name: "cursor", schema: { type: "integer" } }],
                responses: { "200": { description: "Список движений" } }
            }
        },
        "/replicate/train": {
            post: {
                tags: ["AI - Replicate"],
                summary: "Тренировка модели (LoRA)",
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                required: ["modelName", "triggerWord", "replicateImages"],
                                properties: {
                                    replicateImages: { type: "array", items: { type: "string", format: "binary" }, description: "10-20 изображений" },
                                    modelName: { type: "string" },
                                    triggerWord: { type: "string" },
                                    loraType: { type: "string", enum: ["subject", "style"] }
                                }
                            }
                        }
                    }
                },
                responses: { "202": { description: "Тренировка запущена" } }
            }
        },
        "/replicate/generate": {
            post: {
                tags: ["AI - Replicate"],
                summary: "Генерация по обученной модели",
                requestBody: {
                    content: { "application/json": { schema: { type: "object", required: ["modelDestination", "prompt"], properties: { modelDestination: { type: "string" }, prompt: { type: "string" }, aspectRatio: { type: "string" }, numOutputs: { type: "integer" } } } } }
                },
                responses: { "202": { description: "Генерация запущена" } }
            }
        },
        "/replicate/models": {
            get: { tags: ["AI - Replicate"], summary: "Мои обученные модели", responses: { "200": { description: "Список моделей" } } }
        },
        "/replicate/models/{modelId}": {
            delete: { tags: ["AI - Replicate"], summary: "Удалить модель", parameters: [{ in: "path", name: "modelId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Удалено" } } }
        },

        // --- ADMIN ---
        "/admin/login": {
            post: {
                tags: ["Admin"],
                summary: "Вход для админа",
                requestBody: { content: { "application/json": { schema: { type: "object", required: ["username", "password"], properties: { username: { type: "string" }, password: { type: "string" } } } } } },
                responses: { "200": { description: "Успешный вход" } }
            }
        },
        "/admin/users": {
            get: { tags: ["Admin"], summary: "Все пользователи", responses: { "200": { description: "Список" } } }
        },
        "/admin/users/{userId}/block": {
            put: { tags: ["Admin"], summary: "Блокировать пользователя", parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Заблокирован" } } }
        },
        "/admin/users/{userId}/unblock": {
            put: { tags: ["Admin"], summary: "Разблокировать пользователя", parameters: [{ in: "path", name: "userId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Разблокирован" } } }
        },
        "/admin/publications/{publicationId}": {
            delete: { tags: ["Admin"], summary: "Удалить любую публикацию", parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Удалено" } } }
        },
        "/admin/publications/{publicationId}/photo-of-the-day": {
            put: { tags: ["Admin"], summary: "Сделать фото дня", parameters: [{ in: "path", name: "publicationId", required: true, schema: { type: "string" } }], responses: { "200": { description: "Успешно" } } }
        }
    }
};