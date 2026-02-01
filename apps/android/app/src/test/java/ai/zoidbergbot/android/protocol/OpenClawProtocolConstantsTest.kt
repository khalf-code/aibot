package ai.zoidbergbot.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class ZoidbergBotProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", ZoidbergBotCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", ZoidbergBotCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", ZoidbergBotCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", ZoidbergBotCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", ZoidbergBotCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", ZoidbergBotCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", ZoidbergBotCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", ZoidbergBotCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", ZoidbergBotCapability.Canvas.rawValue)
    assertEquals("camera", ZoidbergBotCapability.Camera.rawValue)
    assertEquals("screen", ZoidbergBotCapability.Screen.rawValue)
    assertEquals("voiceWake", ZoidbergBotCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", ZoidbergBotScreenCommand.Record.rawValue)
  }
}
