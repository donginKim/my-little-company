class Mlc < Formula
  desc "AI-powered solo development studio — one developer, a full AI team"
  homepage "https://github.com/donginKim/my-little-company"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/donginKim/my-little-company/releases/download/v#{version}/mlc-macos-arm64"
      sha256 "REPLACE_WITH_SHA256_OF_mlc-macos-arm64"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/donginKim/my-little-company/releases/download/v#{version}/mlc-linux-x64"
      sha256 "REPLACE_WITH_SHA256_OF_mlc-linux-x64"
    end
  end

  def install
    binary = on_macos { "mlc-macos-arm64" } || "mlc-linux-x64"
    bin.install binary => "mlc"
  end

  test do
    assert_match "My Little Company", shell_output("#{bin}/mlc --help")
  end
end
