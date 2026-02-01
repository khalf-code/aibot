package ai.zoidbergbot.android.ui

import androidx.compose.runtime.Composable
import ai.zoidbergbot.android.MainViewModel
import ai.zoidbergbot.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
