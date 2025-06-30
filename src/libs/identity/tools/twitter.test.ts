import { describe, test, expect } from "bun:test"
import { getTweetByUrl, getTweetByUrlWithRetry } from "./twitter"

describe("Twitter Scraper", () => {
    test("should extract tweet from valid URL", async () => {
        const tweetUrl = "https://x.com/tcookingsenpai/status/1938517728379167227"
        
        const result = await getTweetByUrl(tweetUrl)
        
        expect(result).not.toBeNull()
        expect(result?.id).toBe("1938517728379167227")
        expect(result?.username.toLowerCase()).toBe("tcookingsenpai")
        expect(result?.text).toBeDefined()
        expect(result?.text.length).toBeGreaterThan(0)
        
        console.log("✅ Tweet content:", result?.text)
    }, 30000) // 30 second timeout for network requests
    
    test("should handle twitter.com URL", async () => {
        const tweetUrl = "https://twitter.com/tcookingsenpai/status/1938517728379167227"
        
        const result = await getTweetByUrl(tweetUrl)
        
        expect(result).not.toBeNull()
        expect(result?.id).toBe("1938517728379167227")
        expect(result?.username.toLowerCase()).toBe("tcookingsenpai")
        expect(result?.text).toBeDefined()
        expect(result?.text.length).toBeGreaterThan(0)
    }, 30000)
    
    test("should handle invalid URL gracefully", async () => {
        const invalidUrl = "https://x.com/invalid/url/format"
        
        expect(getTweetByUrl(invalidUrl)).rejects.toThrow("Invalid tweet URL")
    })
    
    test("should return null for non-existent tweet", async () => {
        const nonExistentUrl = "https://x.com/tcookingsenpai/status/9999999999999999999"
        
        const result = await getTweetByUrl(nonExistentUrl)
        
        expect(result).toBeNull()
    }, 30000)
    
    test("should work with retry function", async () => {
        const tweetUrl = "https://x.com/tcookingsenpai/status/1938517728379167227"
        
        const result = await getTweetByUrlWithRetry(tweetUrl, 2, 1000)
        
        expect(result).not.toBeNull()
        expect(result?.id).toBe("1938517728379167227")
        expect(result?.username.toLowerCase()).toBe("tcookingsenpai")
        expect(result?.text).toBeDefined()
        expect(result?.text.length).toBeGreaterThan(0)
        
        console.log("✅ Retry test passed with content:", result?.text)
    }, 60000) // 60 second timeout for retry logic

    test("should handle consecutive tweet fetching and measure rate limits", async () => {
        // Test with multiple different tweets to see rate limiting behavior
        const testTweets = [
            "https://x.com/tcookingsenpai/status/1938517728379167227",
            "https://twitter.com/tcookingsenpai/status/1938517728379167227", // Same tweet, different URL
            "https://x.com/elonmusk/status/1", // Non-existent tweet
            "https://x.com/twitter/status/1", // Another non-existent tweet
        ]
        
        const results = []
        const timings = []
        const startTime = Date.now()
        
        console.log("🔄 Testing consecutive tweet fetching...")
        
        for (let i = 0; i < testTweets.length; i++) {
            const tweetStart = Date.now()
            try {
                console.log(`📋 Request ${i + 1}/${testTweets.length}: ${testTweets[i]}`)
                const result = await getTweetByUrl(testTweets[i])
                const tweetEnd = Date.now()
                const duration = tweetEnd - tweetStart
                
                results.push({
                    url: testTweets[i],
                    success: result !== null,
                    duration: duration,
                    text: result?.text?.substring(0, 50) + (result?.text && result.text.length > 50 ? "..." : ""),
                })
                
                timings.push(duration)
                console.log(`✅ Request ${i + 1} completed in ${duration}ms - ${result ? "SUCCESS" : "NULL"}`)
                
                // Small delay between requests to be respectful
                if (i < testTweets.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                }
            } catch (error) {
                const tweetEnd = Date.now()
                const duration = tweetEnd - tweetStart
                
                results.push({
                    url: testTweets[i],
                    success: false,
                    duration: duration,
                    error: error instanceof Error ? error.message : "Unknown error",
                })
                
                timings.push(duration)
                console.log(`❌ Request ${i + 1} failed in ${duration}ms - ${error instanceof Error ? error.message : "Unknown error"}`)
            }
        }
        
        const totalTime = Date.now() - startTime
        const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length
        const successCount = results.filter(r => r.success).length
        
        console.log("\n📊 Rate Limiting Test Results:")
        console.log(`Total requests: ${testTweets.length}`)
        console.log(`Successful requests: ${successCount}`)
        console.log(`Failed requests: ${testTweets.length - successCount}`)
        console.log(`Total time: ${totalTime}ms`)
        console.log(`Average time per request: ${avgTime.toFixed(2)}ms`)
        console.log(`Requests per minute (theoretical): ${(60000 / avgTime).toFixed(2)}`)
        
        // Log detailed results
        results.forEach((result, i) => {
            console.log(`Request ${i + 1}: ${result.success ? "✅" : "❌"} ${result.duration}ms ${result.text || result.error || ""}`)
        })
        
        // Basic assertions
        expect(results.length).toBe(testTweets.length)
        expect(successCount).toBeGreaterThan(0) // At least one should succeed
        expect(avgTime).toBeLessThan(10000) // Average should be under 10 seconds
        
    }, 120000) // 2 minute timeout for rate limit testing
    
    test("should handle burst requests and identify rate limiting", async () => {
        const sameUrl = "https://x.com/tcookingsenpai/status/1938517728379167227"
        const burstCount = 10
        const results = []
        
        console.log(`🚀 Testing burst requests (${burstCount} requests to same URL)...`)
        
        const startTime = Date.now()
        const promises = Array.from({ length: burstCount }, (unused, i) => 
            getTweetByUrl(sameUrl).then(result => ({
                requestNumber: i + 1,
                success: result !== null,
                timestamp: Date.now(),
                result,
            })).catch(error => ({
                requestNumber: i + 1,
                success: false,
                timestamp: Date.now(),
                error: error instanceof Error ? error.message : "Unknown error",
            })),
        )
        
        const responses = await Promise.allSettled(promises)
        const endTime = Date.now()
        
        responses.forEach((response, i) => {
            if (response.status === "fulfilled") {
                results.push(response.value)
                console.log(`Request ${i + 1}: ${response.value.success ? "✅" : "❌"} ${"error" in response.value ? response.value.error : "SUCCESS"}`)
            } else {
                results.push({
                    requestNumber: i + 1,
                    success: false,
                    timestamp: endTime,
                    error: response.reason,
                })
                console.log(`Request ${i + 1}: ❌ REJECTED - ${response.reason}`)
            }
        })
        
        const successCount = results.filter(r => r.success).length
        const totalTime = endTime - startTime
        
        console.log("\n🎯 Burst Test Results:")
        console.log(`Total requests: ${burstCount}`)
        console.log(`Successful requests: ${successCount}`)
        console.log(`Failed requests: ${burstCount - successCount}`)
        console.log(`Total time: ${totalTime}ms`)
        console.log(`Requests per second: ${(burstCount / (totalTime / 1000)).toFixed(2)}`)
        
        if (successCount < burstCount) {
            console.log(`⚠️  Rate limiting detected: ${((burstCount - successCount) / burstCount * 100).toFixed(1)}% failure rate`)
        } else {
            console.log("✅ No rate limiting detected in burst test")
        }
        
        // Assertions
        expect(results.length).toBe(burstCount)
        expect(successCount).toBeGreaterThan(0) // At least some should succeed
        
    }, 120000) // 2 minute timeout for burst testing
})