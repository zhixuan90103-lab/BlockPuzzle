import UIKit
import Capacitor
import WebKit

@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeHapticsPlugin())
        CAPLog.print("⚡️ NativeHapticsPlugin registered manually")
        hardenWebViewTouches()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // 部分手势在 didLoad 后才挂上，再关一次
        hardenWebViewTouches()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // 布局后系统可能再注入长按手势
        hardenWebViewTouches()
    }

    /// 关掉 WKWebView 双指缩放、双击放大、长按放大镜 / 选择 / 预览
    private func hardenWebViewTouches() {
        guard let webView = self.webView else { return }

        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = true

        // iOS 14.5+：彻底关文本交互（放大镜 / 选区）
        if #available(iOS 14.5, *) {
            webView.configuration.preferences.isTextInteractionEnabled = false
        }
        if #available(iOS 15.4, *) {
            webView.configuration.preferences.isElementFullscreenEnabled = false
        }

        let scroll = webView.scrollView
        scroll.isScrollEnabled = false
        scroll.bounces = false
        scroll.bouncesZoom = false
        scroll.alwaysBounceVertical = false
        scroll.alwaysBounceHorizontal = false
        scroll.minimumZoomScale = 1.0
        scroll.maximumZoomScale = 1.0
        scroll.zoomScale = 1.0
        scroll.delaysContentTouches = false
        scroll.canCancelContentTouches = false
        scroll.showsVerticalScrollIndicator = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.pinchGestureRecognizer?.isEnabled = false
        scroll.panGestureRecognizer.isEnabled = false

        // 递归关掉捏合 / 双击 / 长按（含子 view 上后挂的手势）
        disableBadGestures(in: webView)
        disableBadGestures(in: scroll)
        for sub in scroll.subviews {
            disableBadGestures(in: sub)
        }
    }

    private func disableBadGestures(in view: UIView) {
        disableZoomGestures(in: view.gestureRecognizers)
        for sub in view.subviews {
            disableBadGestures(in: sub)
        }
    }

    private func disableZoomGestures(in recognizers: [UIGestureRecognizer]?) {
        guard let recognizers else { return }
        for gr in recognizers {
            if gr is UIPinchGestureRecognizer {
                gr.isEnabled = false
                continue
            }
            if let tap = gr as? UITapGestureRecognizer, tap.numberOfTapsRequired >= 2 {
                gr.isEnabled = false
                continue
            }
            // 长按放大镜 / 选择 / callout
            if gr is UILongPressGestureRecognizer {
                gr.isEnabled = false
                continue
            }
        }
    }
}
