// A pretend iPhone app with faults planted in it, for the iPhone testers' proof (core/ios.js): a button that does nothing,
// one too small to tap, text over text, a placeholder word, a box at the bottom the keyboard covers, and a button that
// crashes the app. "Next" works, and must not be reported.
import SwiftUI

@main
struct PlantedApp: App {
  var body: some Scene { WindowGroup { ContentView() } }
}

struct ContentView: View {
  @State private var title = "Planted app"
  @State private var message = ""
  @State private var crash: Int? = nil

  var body: some View {
    ZStack(alignment: .bottom) {
      VStack(alignment: .leading, spacing: 14) {
        Text(title).font(.largeTitle)
        Button("Save") {}
        Button("Next") { title = title == "Planted app" ? "Second step" : "Planted app" }
        Button("Crash") { title = String(crash!) }
        Button("?") { title = "Help" }.frame(width: 22, height: 22)
        Text("Price: undefined")
        ZStack(alignment: .topLeading) {
          Text("Free delivery today").font(.title3)
          Text("Order before noon").font(.title3).padding(.leading, 30).padding(.top, 6)
        }
        Spacer()
      }
      .padding()
      .frame(maxWidth: .infinity, alignment: .leading)
      TextField("Message", text: $message)
        .textFieldStyle(.roundedBorder)
        .padding()
    }
    .ignoresSafeArea(.keyboard)
  }
}
