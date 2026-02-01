import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export default function ResizePage() {
  return (
    <div className="h-screen p-8">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center p-4">
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-gray-300 bg-card p-6">
              <span className="font-semibold">One</span>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-gray-300" />
        <ResizablePanel defaultSize={50}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={25}>
              <div className="flex h-full items-center justify-center p-4">
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-gray-300 bg-card p-6">
                  <span className="font-semibold">Two</span>
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-gray-300" />
            <ResizablePanel defaultSize={75}>
              <div className="flex h-full items-center justify-center p-4">
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-gray-300 bg-card p-6">
                  <span className="font-semibold">Three</span>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
