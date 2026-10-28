// A pretend iPhone app with faults planted in it, for the iPhone testers' proof (core/ios.js): a button that does nothing,
// one too small to tap, text over text, a placeholder word, a box at the bottom the keyboard covers, and a button that
// crashes the app. "Next" works, and must not be reported. MONEY (2026-10-27): a promo box that takes any code, a subscribe
// step with no price, and paid reports walled off only by a saved setting (isPro) that the testers can flip.
import SwiftUI

@main
struct PlantedApp: App {
  var body: some Scene { WindowGroup { ContentView() } }
}

struct ContentView: View {
  @State private var title = "Planted app"
  @State private var message = ""
  @State private var crash: Int? = nil
  @State private var promo = ""
  @State private var card = ""
  @State private var total = "Order total: $20"
  @State private var promoMsg = ""
  @State private var showPay = false
  @AppStorage("isPro") private var isPro = false
  // (stored on first launch, as an app does after its purchase check: SwiftUI keeps a default only in memory until it is set)
  init() { if UserDefaults.standard.object(forKey: "isPro") == nil { UserDefaults.standard.set(false, forKey: "isPro") } }

  var body: some View {
    // (the pay step is its own screen, as a real one is: nothing from the plan page, so nothing there says the price)
    if showPay {
      VStack(alignment: .leading, spacing: 14) {
        Text("Complete your subscription. Enter your card and pay now.")
        TextField("Card number", text: $card)
        Button("Pay now") {}
        Spacer()
      }
      .padding()
    } else {
      plan
    }
  }

  var plan: some View {
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
        // money: promo box takes any code; Subscribe opens a pay step with no price; reports walled off only by isPro
        Text("Analytics Pro, $12/mo. Start your free trial. Subscribe to unlock.")
        Text(total)
        TextField("Promo code", text: $promo)
        Button("Apply") { total = "Order total: $1"; promoMsg = "Code applied! 95% off." }
        Text(promoMsg)
        Button("Subscribe") { showPay = true }
        if isPro {
          Text("Your weekly reports. " + String(repeating: "Revenue up. Churn down. More numbers here. ", count: 30))
        } else {
          Text("Upgrade to Pro to unlock your reports.")
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
