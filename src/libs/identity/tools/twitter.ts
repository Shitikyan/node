import https from "https"
import http from "http"
import { URL } from "url"
import { gunzipSync, inflateSync } from "zlib"
import log from "@/utilities/logger"

interface TweetData {
    id: string
    username: string
    text: string
    createdAt?: string
    likes?: number
    retweets?: number
    replies?: number
}

export class TwitterScraper {
    private static instance: TwitterScraper = null

    /**
     * Extracts tweet details from a Twitter/X URL
     * @param tweetUrl - Twitter/X URL (supports both twitter.com and x.com)
     * @returns Object containing username and tweet ID
     */
    extractTweetDetails(tweetUrl: string): {
        username: string
        tweetId: string
    } {
        try {
            // Normalize URL to handle both twitter.com and x.com
            const normalizedUrl = tweetUrl.replace(
                /^https?:\/\/(www\.)?(twitter\.com|x\.com)/,
                "https://twitter.com",
            )
            const url = new URL(normalizedUrl)
            const pathParts = url.pathname
                .split("/")
                .filter(part => part.length > 0)

            // Tweet URLs follow pattern: twitter.com/username/status/tweetId
            const statusIndex = pathParts.indexOf("status")
            if (
                statusIndex === -1 ||
                statusIndex === 0 ||
                !pathParts[statusIndex + 1]
            ) {
                throw new Error("Invalid tweet URL format")
            }

            const username = pathParts[statusIndex - 1]
            const tweetId = pathParts[statusIndex + 1]

            if (!username || !tweetId) {
                throw new Error(
                    "Invalid tweet URL format - missing username or tweet ID",
                )
            }

            return { username, tweetId }
        } catch (error) {
            console.error(
                `Failed to extract tweet details from URL: ${tweetUrl}`,
            )
            throw new Error(
                `Invalid tweet URL: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            )
        }
    }

    /**
     * Makes an HTTP request to fetch webpage content
     * @param url - The URL to fetch
     * @param headers - Optional headers to include
     * @returns Promise resolving to response body
     */
    makeHttpRequest(
        url: string,
        headers: Record<string, string> = {},
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url)
            const isHttps = urlObj.protocol === "https:"
            const client = isHttps ? https : http

            const defaultHeaders = {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                Connection: "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                ...headers,
            }

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: "GET",
                headers: defaultHeaders,
            }

            const req = client.request(options, res => {
                const chunks: Buffer[] = []

                res.on("data", chunk => {
                    chunks.push(chunk)
                })

                res.on("end", () => {
                    if (
                        res.statusCode &&
                        res.statusCode >= 200 &&
                        res.statusCode < 300
                    ) {
                        try {
                            let buffer = Buffer.concat(chunks) as Buffer
                            let data = ""

                            // Handle compressed responses
                            const encoding = res.headers["content-encoding"]
                            if (encoding === "gzip") {
                                buffer = gunzipSync(buffer)
                            } else if (encoding === "deflate") {
                                buffer = inflateSync(buffer)
                            }

                            data = buffer.toString("utf8")
                            resolve(data)
                        } catch (decompressError) {
                            // If decompression fails, try as plain text
                            const data = Buffer.concat(chunks).toString("utf8")
                            resolve(data)
                        }
                    } else if (
                        res.statusCode &&
                        res.statusCode >= 300 &&
                        res.statusCode < 400 &&
                        res.headers.location
                    ) {
                        // Handle redirects
                        this.makeHttpRequest(res.headers.location, headers)
                            .then(resolve)
                            .catch(reject)
                    } else {
                        reject(
                            new Error(
                                `HTTP ${res.statusCode}: ${res.statusMessage}`,
                            ),
                        )
                    }
                })
            })

            req.on("error", error => {
                reject(error)
            })

            req.setTimeout(30000, () => {
                req.destroy()
                reject(new Error("Request timeout"))
            })

            req.end()
        })
    }

    /**
     * Extracts tweet data from Twitter's JSON API response
     * @param jsonData - The JSON response from Twitter APIs
     * @param expectedUsername - The expected username to validate
     * @param expectedTweetId - The expected tweet ID to validate
     * @returns Extracted tweet data or null if not found
     */
    extractTweetFromJson(
        jsonData: any,
        expectedUsername: string,
        expectedTweetId: string,
    ): TweetData | null {
        try {
            // REVIEW: Handle oEmbed API response
            if (jsonData.html && jsonData.author_name) {
                // Extract text from the oEmbed HTML blockquote
                const htmlMatch = jsonData.html.match(/<p[^>]*>(.*?)<\/p>/s)
                if (htmlMatch) {
                    let text = htmlMatch[1]
                        .replace(/<[^>]*>/g, "")
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        // eslint-disable-next-line quotes
                        .replace(/&quot;/g, '"')
                        .replace(/\\u003C/g, "<")
                        .replace(/\\u003E/g, ">")
                        .replace(/\\\//g, "/")
                        .trim()

                    // Clean up any remaining escape sequences
                    try {
                        text = JSON.parse(`"${text}"`)
                    } catch (e) {
                        // If JSON parsing fails, use as-is
                    }

                    // Extract username from author_url or check both author_name and author_url
                    const authorUrlMatch = jsonData.author_url?.match(
                        /twitter\.com\/([^/?]+)/,
                    )
                    const extractedUsername = authorUrlMatch
                        ? authorUrlMatch[1]
                        : null

                    if (
                        extractedUsername?.toLowerCase() ===
                            expectedUsername.toLowerCase() ||
                        jsonData.author_name
                            .toLowerCase()
                            .includes(expectedUsername.toLowerCase())
                    ) {
                        return {
                            id: expectedTweetId,
                            username: extractedUsername || expectedUsername,
                            text: text,
                        }
                    }
                }
            }

            // REVIEW: Handle timeline/syndication API response
            if (jsonData.body && Array.isArray(jsonData.body)) {
                for (const tweet of jsonData.body) {
                    if (
                        tweet.id_str === expectedTweetId &&
                        tweet.user &&
                        tweet.user.screen_name.toLowerCase() ===
                            expectedUsername.toLowerCase()
                    ) {
                        return {
                            id: tweet.id_str,
                            username: tweet.user.screen_name,
                            text: tweet.text || tweet.full_text || "",
                            createdAt: tweet.created_at,
                            likes: tweet.favorite_count,
                            retweets: tweet.retweet_count,
                            replies: tweet.reply_count,
                        }
                    }
                }
            }

            // REVIEW: Handle single tweet JSON response
            if (
                jsonData.id_str === expectedTweetId &&
                jsonData.user &&
                jsonData.user.screen_name.toLowerCase() ===
                    expectedUsername.toLowerCase()
            ) {
                return {
                    id: jsonData.id_str,
                    username: jsonData.user.screen_name,
                    text: jsonData.text || jsonData.full_text || "",
                    createdAt: jsonData.created_at,
                    likes: jsonData.favorite_count,
                    retweets: jsonData.retweet_count,
                    replies: jsonData.reply_count,
                }
            }

            return null
        } catch (error) {
            console.error("Failed to extract tweet from JSON")
            return null
        }
    }

    /**
     * Extracts tweet data from Twitter's HTML response
     * @param html - The HTML content from Twitter
     * @param expectedUsername - The expected username to validate
     * @param expectedTweetId - The expected tweet ID to validate
     * @returns Extracted tweet data or null if not found
     */
    extractTweetFromHtml(
        html: string,
        expectedUsername: string,
        expectedTweetId: string,
    ): TweetData | null {
        try {
            // REVIEW: Look for JSON-LD structured data first (most reliable)
            const jsonLdMatch = html.match(
                /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s,
            )
            if (jsonLdMatch) {
                try {
                    const jsonData = JSON.parse(jsonLdMatch[1])
                    if (
                        jsonData["@type"] === "SocialMediaPosting" &&
                        jsonData.url &&
                        jsonData.author
                    ) {
                        const tweetId = jsonData.url.split("/").pop()
                        const username =
                            jsonData.author.alternateName ||
                            jsonData.author.name

                        if (
                            tweetId === expectedTweetId &&
                            username.toLowerCase() ===
                                expectedUsername.toLowerCase()
                        ) {
                            return {
                                id: tweetId,
                                username: username,
                                text:
                                    jsonData.articleBody ||
                                    jsonData.headline ||
                                    "",
                                createdAt: jsonData.datePublished,
                            }
                        }
                    }
                } catch (e) {
                    // Continue to other methods if JSON-LD parsing fails
                }
            }

            // REVIEW: Look for Open Graph meta tags
            const ogTitleMatch = html.match(
                /<meta property="og:title" content="([^"]*)"/,
            )
            const ogDescriptionMatch = html.match(
                /<meta property="og:description" content="([^"]*)"/,
            )
            const ogUrlMatch = html.match(
                /<meta property="og:url" content="([^"]*)"/,
            )

            if (ogTitleMatch && ogDescriptionMatch && ogUrlMatch) {
                const urlParts = ogUrlMatch[1].split("/")
                const tweetId = urlParts[urlParts.length - 1]
                const username = urlParts[urlParts.length - 3]

                if (
                    tweetId === expectedTweetId &&
                    username.toLowerCase() === expectedUsername.toLowerCase()
                ) {
                    return {
                        id: tweetId,
                        username: username,
                        text: ogDescriptionMatch[1],
                    }
                }
            }

            // REVIEW: Look for Twitter meta tags
            const twitterTitleMatch = html.match(
                /<meta name="twitter:title" content="([^"]*)"/,
            )
            const twitterDescriptionMatch = html.match(
                /<meta name="twitter:description" content="([^"]*)"/,
            )

            if (twitterTitleMatch && twitterDescriptionMatch) {
                // Extract username from title (format: "Username on X: ...")
                const titleParts = twitterTitleMatch[1].split(" on X:")
                if (
                    titleParts.length > 1 &&
                    titleParts[0].toLowerCase() ===
                        expectedUsername.toLowerCase()
                ) {
                    return {
                        id: expectedTweetId,
                        username: expectedUsername,
                        text: twitterDescriptionMatch[1],
                    }
                }
            }

            // REVIEW: Fallback - look for tweet content in HTML
            const tweetTextMatch = html.match(
                /<div[^>]*data-testid="tweetText"[^>]*>(.*?)<\/div>/s,
            )
            if (tweetTextMatch) {
                // Clean HTML tags from tweet text
                const cleanText = tweetTextMatch[1]
                    .replace(/<[^>]*>/g, "")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    // eslint-disable-next-line quotes
                    .replace(/&quot;/g, '"')
                    .trim()

                return {
                    id: expectedTweetId,
                    username: expectedUsername,
                    text: cleanText,
                }
            }

            return null
        } catch (error) {
            console.error("Failed to extract tweet from HTML")
            return null
        }
    }

    /**
     * Fetches a single tweet by URL using direct HTTP scraping
     * @param tweetUrl - The Twitter/X URL of the tweet
     * @returns Promise resolving to tweet data or null if not found
     */
    async getTweetByUrl(tweetUrl: string): Promise<TweetData | null> {
        try {
            // REVIEW: Validate and extract tweet details
            const { username, tweetId } = this.extractTweetDetails(tweetUrl)

            console.debug(`🐦 Fetching tweet ${tweetId} from user ${username}`)

            // REVIEW: Try multiple approaches for maximum reliability
            const attempts = [
                // Attempt 1: Direct embed oembed API (public, most reliable)
                `https://publish.twitter.com/oembed?url=${encodeURIComponent(
                    tweetUrl,
                )}&omit_script=true`,
                // Attempt 2: Try with twitter.com URL
                `https://publish.twitter.com/oembed?url=${encodeURIComponent(
                    `https://twitter.com/${username}/status/${tweetId}`,
                )}&omit_script=true`,
                // Attempt 3: Direct Twitter URL (fallback)
                tweetUrl,
                // Attempt 4: X.com URL (fallback)
                `https://x.com/${username}/status/${tweetId}`,
            ]

            for (let i = 0; i < attempts.length; i++) {
                try {
                    console.debug(`🐦 Attempt ${i + 1}: ${attempts[i]}`)

                    const html = await this.makeHttpRequest(attempts[i], {
                        // REVIEW: Rotate user agents to avoid detection
                        "User-Agent":
                            i % 2 === 0
                                ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                                : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    })

                    // Try to parse as JSON first (for API responses)
                    let tweetData: TweetData | null = null
                    try {
                        const jsonData = JSON.parse(html)
                        tweetData = this.extractTweetFromJson(
                            jsonData,
                            username,
                            tweetId,
                        )
                    } catch (e) {
                        // If not JSON, try HTML parsing
                        tweetData = this.extractTweetFromHtml(
                            html,
                            username,
                            tweetId,
                        )
                    }

                    if (tweetData && tweetData.text.length > 0) {
                        console.debug(
                            `🐦 Successfully fetched tweet ${tweetId}`,
                        )
                        return tweetData
                    }
                } catch (error) {
                    console.debug(
                        `🐦 Attempt ${i + 1} failed: ${
                            error instanceof Error
                                ? error.message
                                : "Unknown error"
                        }`,
                    )

                    // If it's the last attempt, wait a bit before continuing
                    if (i < attempts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000))
                    }
                }
            }

            console.warn(`🐦 Tweet ${tweetId} not found after all attempts`)
            return null
        } catch (error) {
            console.error(`🐦 Failed to fetch tweet from URL: ${tweetUrl}`)

            // REVIEW: Differentiate between different types of errors
            if (
                error instanceof Error &&
                error.message.includes("Invalid tweet URL")
            ) {
                throw error // Re-throw URL validation errors
            }

            throw new Error(
                `Failed to fetch tweet: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`,
            )
        }
    }

    /**
     * Fetches a tweet with retry logic for enhanced reliability
     * @param tweetUrl - The Twitter/X URL of the tweet
     * @param maxRetries - Maximum number of retry attempts (default: 3)
     * @param retryDelay - Delay between retries in milliseconds (default: 2000)
     * @returns Promise resolving to tweet data or null if not found
     */
    async getTweetByUrlWithRetry(
        tweetUrl: string,
        maxRetries = 3,
        retryDelay = 2000,
    ): Promise<TweetData | null> {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.debug(`🐦 Retry attempt ${attempt}/${maxRetries}`)
                return await this.getTweetByUrl(tweetUrl)
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error("Unknown error")
                console.warn(
                    `🐦 Retry attempt ${attempt} failed: ${lastError.message}`,
                )

                // Don't retry on URL validation errors
                if (lastError.message.includes("Invalid tweet URL")) {
                    throw lastError
                }

                // Wait before retrying (except on last attempt)
                if (attempt < maxRetries) {
                    await new Promise(resolve =>
                        setTimeout(resolve, retryDelay * attempt),
                    ) // Exponential backoff
                }
            }
        }

        throw lastError || new Error("Max retries exceeded")
    }
}
