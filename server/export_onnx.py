"""
Экспорт Real-ESRGAN compact (SRVGGNetCompact) в ONNX.
Архитектура определена вручную — не требует basicsr/realesrgan.
"""

import os
import sys
import urllib.request

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------------------
# SRVGGNetCompact — архитектура из Real-ESRGAN
# ---------------------------------------------------------------------------

class SRVGGNetCompact(nn.Module):
    """Compact VGG-style network for super-resolution (from Real-ESRGAN)."""

    def __init__(
        self,
        num_in_ch: int = 3,
        num_out_ch: int = 3,
        num_feat: int = 64,
        num_conv: int = 16,
        upscale: int = 4,
        act_type: str = "prelu",
    ):
        super().__init__()
        self.upscale = upscale

        self.body = nn.ModuleList()
        # Первый слой
        self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
        self.body.append(self._act(act_type, num_feat))

        # Промежуточные слои
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            self.body.append(self._act(act_type, num_feat))

        # Последний слой — upscale через sub-pixel convolution
        self.body.append(
            nn.Conv2d(num_feat, num_out_ch * (upscale ** 2), 3, 1, 1)
        )

        self.pixel_shuffle = nn.PixelShuffle(upscale)

    @staticmethod
    def _act(act_type: str, num_feat: int) -> nn.Module:
        if act_type == "prelu":
            return nn.PReLU(num_parameters=num_feat)
        elif act_type == "relu":
            return nn.ReLU(inplace=True)
        elif act_type == "leakyrelu":
            return nn.LeakyReLU(negative_slope=0.1, inplace=True)
        else:
            raise ValueError(f"Unknown act_type: {act_type}")

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.pixel_shuffle(out)
        # Добавляем upscaled input (residual)
        base = F.interpolate(x, scale_factor=self.upscale, mode="bilinear", align_corners=False)
        return out + base


# ---------------------------------------------------------------------------
# Скачивание весов
# ---------------------------------------------------------------------------

WEIGHTS_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth"
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "weights", "realesr-general-x4v3.pth")
ONNX_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "models", "realesrgan-x4.onnx")


def download_weights():
    os.makedirs(os.path.dirname(WEIGHTS_PATH), exist_ok=True)
    if os.path.exists(WEIGHTS_PATH):
        print(f"Веса уже скачаны: {WEIGHTS_PATH}")
        return
    print(f"Скачиваю веса: {WEIGHTS_URL}")
    urllib.request.urlretrieve(WEIGHTS_URL, WEIGHTS_PATH)
    size_mb = os.path.getsize(WEIGHTS_PATH) / 1024 / 1024
    print(f"Скачано: {size_mb:.1f} MB")


# ---------------------------------------------------------------------------
# Экспорт в ONNX
# ---------------------------------------------------------------------------

def export_onnx():
    download_weights()

    print("Загружаю модель...")
    model = SRVGGNetCompact(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_conv=32,
        upscale=4,
        act_type="prelu",
    )

    # Загружаем веса
    state = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=True)
    # Некоторые чекпоинты оборачивают в 'params' или 'params_ema'
    if "params_ema" in state:
        state = state["params_ema"]
    elif "params" in state:
        state = state["params"]

    model.load_state_dict(state, strict=True)
    model.eval()

    print("Экспортирую в ONNX...")
    os.makedirs(os.path.dirname(ONNX_OUTPUT), exist_ok=True)

    dummy_input = torch.randn(1, 3, 64, 64)

    torch.onnx.export(
        model,
        dummy_input,
        ONNX_OUTPUT,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
            "input": {0: "batch", 2: "height", 3: "width"},
            "output": {0: "batch", 2: "height", 3: "width"},
        },
        opset_version=17,
        do_constant_folding=True,
    )

    size_mb = os.path.getsize(ONNX_OUTPUT) / 1024 / 1024
    print(f"ONNX экспортирован: {ONNX_OUTPUT} ({size_mb:.1f} MB)")

    # Верификация
    print("Проверяю ONNX...")
    import onnx
    onnx_model = onnx.load(ONNX_OUTPUT)
    onnx.checker.check_model(onnx_model)
    print("ONNX валиден!")

    # Тест inference
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(ONNX_OUTPUT)
        import numpy as np
        test_input = np.random.randn(1, 3, 64, 64).astype(np.float32)
        result = sess.run(None, {"input": test_input})
        print(f"Test inference OK: input (1,3,64,64) → output {result[0].shape}")
    except ImportError:
        print("onnxruntime не установлен, пропускаю тест inference")


if __name__ == "__main__":
    export_onnx()
