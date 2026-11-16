
import {
    fireEvent,
    render,
    waitFor,
} from "@testing-library/react-native";

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import {
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";

import HomeScreen from "../src/app/index";

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: require("@jest/globals").jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: require("@jest/globals").jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));

type HomeView = Awaited<ReturnType<typeof render>>;

const WALLET =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const mockFetch = jest.fn();

const testBird = {
  id: 1,
  imageName: "bird.jpg",
  predictedSpecies: "EAGLE",
  confidence: 0.95,
  analysisDate: "2026-11-14T12:00:00Z",
  description: "Орел",
  extraInfo: "Тест",
};

const analysisResult = {
  savedBird: testBird,
  predictions: [
    { species: "EAGLE", confidence: 0.95 },
    { species: "FALCON", confidence: 0.04 },
    { species: "HAWK", confidence: 0.01 },
  ],
};

let registered = false;
let history: typeof testBird[] = [];
let analysisError = false;

beforeEach(() => {
  jest.clearAllMocks();

  registered = false;
  history = [];
  analysisError = false;

  jest
    .spyOn(Alert, "alert")
    .mockImplementation(() => {});

  globalThis.fetch =
    mockFetch as unknown as typeof fetch;

  mockFetch.mockImplementation(async (url: unknown) => {
    const address = String(url);

    if (address.startsWith("file:")) {
      return {
        ok: true,
        status: 200,
        blob: async () => ({}),
      };
    }

    if (address.includes("/api/Crypto/check/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ registered }),
        text: async () =>
          JSON.stringify({ registered }),
      };
    }

    if (address.includes("/api/Birds/analyze")) {
      return {
        ok: !analysisError,
        status: analysisError ? 500 : 200,
        json: async () => analysisResult,
        text: async () =>
          analysisError
            ? "Помилка сервера"
            : JSON.stringify(analysisResult),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => history,
      text: async () => JSON.stringify(history),
    };
  });

  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///original.jpg",
          fileName: "bird.jpg",
          mimeType: "image/jpeg",
          width: 100,
          height: 100,
        },
      ],
    } as any);

  jest
    .mocked(ImageManipulator.manipulateAsync)
    .mockResolvedValue({
      uri: "file:///converted.jpg",
      width: 100,
      height: 100,
    } as any);
});

// Допоміжна функція для перевірки гаманця
async function activateWallet(view: HomeView) {
  await fireEvent.changeText(
    view.getByPlaceholderText("0x... адреса MetaMask"),
    WALLET
  );

  await fireEvent.press(
    view.getByText("Перевірити гаманець")
  );

  await waitFor(() => {
    expect(
      view.getByText(/Доступ активний/)
    ).toBeTruthy();
  });
}

// Допоміжна функція для вибору фотографії
async function selectPhoto(view: HomeView) {
  await fireEvent.press(
    view.getByText("Вибрати фото")
  );

  await waitFor(() => {
    expect(
      ImagePicker.launchImageLibraryAsync
    ).toHaveBeenCalled();

    expect(
      ImageManipulator.manipulateAsync
    ).toHaveBeenCalled();
  });
}

describe("AI Bird Lab — Mobile Tests", () => {

  // ТЕСТ 1
  it("відображає головний екран", async () => {
    const view = await render(<HomeScreen />);

    expect(
      view.getByText("AI Bird Lab")
    ).toBeTruthy();

    expect(
      view.getByText("Crypto доступ")
    ).toBeTruthy();

    expect(
      view.getByText("Фото птаха")
    ).toBeTruthy();
  });

  // ТЕСТ 2
  it("показує повідомлення, коли історія порожня", async () => {
    const view = await render(<HomeScreen />);

    await waitFor(() => {
      expect(
        view.getByText("Історія поки порожня")
      ).toBeTruthy();
    });
  });

  // ТЕСТ 3
  it("завантажує історію аналізів", async () => {
    history = [testBird];

    const view = await render(<HomeScreen />);

    await waitFor(() => {
      expect(
        view.getByText("EAGLE")
      ).toBeTruthy();

      expect(
        view.getByText("Фото: bird.jpg")
      ).toBeTruthy();
    });
  });

  // ТЕСТ 4
  it("не дозволяє перевірити порожню адресу", async () => {
    const view = await render(<HomeScreen />);

    await fireEvent.press(
      view.getByText("Перевірити гаманець")
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Помилка",
        "Введіть адресу MetaMask"
      );
    });
  });

  // ТЕСТ 5
  it("підтверджує зареєстрований гаманець", async () => {
    registered = true;

    const view = await render(<HomeScreen />);

    await activateWallet(view);

    expect(Alert.alert).toHaveBeenCalledWith(
      "Готово",
      "Доступ активний"
    );
  });

  // ТЕСТ 6
  it("відхиляє незареєстрований гаманець", async () => {
    registered = false;

    const view = await render(<HomeScreen />);

    await fireEvent.changeText(
      view.getByPlaceholderText("0x... адреса MetaMask"),
      WALLET
    );

    await fireEvent.press(
      view.getByText("Перевірити гаманець")
    );

    await waitFor(() => {
      expect(
        view.getByText(/Доступ не підтверджено/)
      ).toBeTruthy();

      expect(Alert.alert).toHaveBeenCalledWith(
        "Немає доступу",
        expect.any(String)
      );
    });
  });

  // ТЕСТ 7
  it("дозволяє вибрати фотографію", async () => {
    const view = await render(<HomeScreen />);

    await selectPhoto(view);

    expect(
      ImagePicker.launchImageLibraryAsync
    ).toHaveBeenCalled();

    expect(
      ImageManipulator.manipulateAsync
    ).toHaveBeenCalled();
  });

  // ТЕСТ 8
  it("успішно аналізує фотографію птаха", async () => {
    registered = true;

    const originalFormData = globalThis.FormData;

    globalThis.FormData = class {
      append = jest.fn();
    } as any;

    try {
      const view = await render(<HomeScreen />);

      await activateWallet(view);
      await selectPhoto(view);

      await fireEvent.press(
        view.getByText("Проаналізувати")
      );

      await waitFor(() => {
        expect(
          view.getByText("Результат аналізу")
        ).toBeTruthy();

        expect(
          view.getByText("Top 3")
        ).toBeTruthy();

        expect(
          view.getAllByText(/95\.00%/).length
        ).toBeGreaterThan(0);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Аналіз завершено",
        "Птах: EAGLE"
      );
    } finally {
      globalThis.FormData = originalFormData;
    }
  });

  // ТЕСТ 9
  it("обробляє помилку AI-аналізу", async () => {
    registered = true;
    analysisError = true;

    const originalFormData = globalThis.FormData;

    globalThis.FormData = class {
      append = jest.fn();
    } as any;

    try {
      const view = await render(<HomeScreen />);

      await activateWallet(view);
      await selectPhoto(view);

      await fireEvent.press(
        view.getByText("Проаналізувати")
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Помилка аналізу",
          expect.stringContaining("HTTP 500")
        );
      });
    } finally {
      globalThis.FormData = originalFormData;
    }
  });

});
