package ai.openclaw.android.gateway

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.pow

class GatewayDiscoveryTimeoutTest {
  @Test
  fun discoveryTimeoutConstantIsDefined() {
    // Verify the constant exists and has the correct value (3 seconds in milliseconds)
    assertEquals(3000L, GatewayDiscovery.DISCOVERY_TIMEOUT_MS)
  }

  @Test
  fun backoffDelayIncreasesExponentially() {
    // Test exponential backoff formula: min(baseDelay * 2^attempt, maxDelay)
    val baseDelay = 5000L
    val maxDelay = 60000L

    // Attempt 0: 5s
    assertEquals(5000L, GatewayDiscovery.calculateBackoffDelay(0, baseDelay, maxDelay))
    
    // Attempt 1: 10s
    assertEquals(10000L, GatewayDiscovery.calculateBackoffDelay(1, baseDelay, maxDelay))
    
    // Attempt 2: 20s
    assertEquals(20000L, GatewayDiscovery.calculateBackoffDelay(2, baseDelay, maxDelay))
    
    // Attempt 3: 40s
    assertEquals(40000L, GatewayDiscovery.calculateBackoffDelay(3, baseDelay, maxDelay))
    
    // Attempt 4: 60s (capped at maxDelay)
    assertEquals(60000L, GatewayDiscovery.calculateBackoffDelay(4, baseDelay, maxDelay))
    
    // Attempt 5+: still 60s (capped)
    assertEquals(60000L, GatewayDiscovery.calculateBackoffDelay(5, baseDelay, maxDelay))
    assertEquals(60000L, GatewayDiscovery.calculateBackoffDelay(10, baseDelay, maxDelay))
  }

  @Test
  fun backoffDelayHandlesEdgeCases() {
    val baseDelay = 5000L
    val maxDelay = 60000L

    // Negative attempts default to attempt 0
    assertEquals(5000L, GatewayDiscovery.calculateBackoffDelay(-1, baseDelay, maxDelay))
    
    // Zero base delay
    assertEquals(0L, GatewayDiscovery.calculateBackoffDelay(0, 0L, maxDelay))
    
    // Very large attempt number should still cap at maxDelay
    assertTrue(GatewayDiscovery.calculateBackoffDelay(100, baseDelay, maxDelay) <= maxDelay)
  }

  @Test
  fun backoffDelayIsMonotonicallyIncreasing() {
    val baseDelay = 5000L
    val maxDelay = 60000L
    
    var previousDelay = 0L
    for (attempt in 0..10) {
      val currentDelay = GatewayDiscovery.calculateBackoffDelay(attempt, baseDelay, maxDelay)
      assertTrue("Backoff delay should be monotonically increasing", currentDelay >= previousDelay)
      previousDelay = currentDelay
    }
  }
}
