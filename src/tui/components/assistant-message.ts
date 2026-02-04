import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";

export class AssistantMessageComponent extends Container {
  private body: Markdown;
  private agentLabel?: Text;

  constructor(text: string, agentName?: string) {
    super();
    this.addChild(new Spacer(1));

    // Show agent name label if provided
    if (agentName) {
      this.agentLabel = new Text(theme.accent(`[${agentName}]`), 1, 0);
      this.addChild(this.agentLabel);
    }

    this.body = new Markdown(text, 1, 0, markdownTheme, {
      color: (line) => theme.fg(line),
    });
    this.addChild(this.body);
  }

  setText(text: string) {
    this.body.setText(text);
  }
}
