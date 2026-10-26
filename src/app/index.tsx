import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { fetch } from "expo/fetch";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Prediction = {
  species: string;
  confidence: number;
};

type Bird = {
  id: number;
  imageName: string;
  predictedSpecies: string;
  confidence: number;
  analysisDate: string;
  description: string;
  extraInfo: string;
};

type AnalyzeResponse = {
  savedBird: Bird;
  predictions: Prediction[];
};

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [result, setResult] =
    useState<AnalyzeResponse | null>(null);

  const [history, setHistory] =
    useState<Bird[]>([]);

  const [loading, setLoading] =
    useState(false);

  const API_URL =
    "http://192.168.31.11:5000/api/Birds";

  async function loadHistory() {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(
          "Помилка отримання історії"
        );
      }

      const data = await response.json();

      setHistory(data);
    } catch (error) {
      console.log(
        "HISTORY ERROR:",
        error
      );
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function pickImage() {
    const permission =
      await ImagePicker
        .requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Помилка",
        "Потрібно дозволити доступ до галереї"
      );

      return;
    }

    const pickerResult =
      await ImagePicker
        .launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 1,
        });

    if (!pickerResult.canceled) {
      const asset =
        pickerResult.assets[0];

      setImageUri(asset.uri);

      setResult(null);
    }
  }

  async function analyzeImage() {
    if (!imageUri) {
      Alert.alert(
        "Помилка",
        "Спочатку оберіть фотографію"
      );

      return;
    }

    try {
      setLoading(true);

      const context =
        ImageManipulator
          .ImageManipulator
          .manipulate(imageUri);

      const renderedImage =
        await context.renderAsync();

      const jpegImage =
        await renderedImage.saveAsync({
          format:
            ImageManipulator
              .SaveFormat
              .JPEG,

          compress: 0.9,
        });

      console.log(
        "JPEG URI:",
        jpegImage.uri
      );

      const imageFile =
        new File(jpegImage.uri);

      const formData =
        new FormData();

      formData.append(
        "file",
        imageFile
      );

      const response =
        await fetch(
          API_URL + "/analyze",
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        const text =
          await response.text();

        console.log(
          "SERVER ERROR:",
          text
        );

        Alert.alert(
          "Помилка",
          "Сервер повернув помилку"
        );

        return;
      }

      const data: AnalyzeResponse =
        await response.json();

      setResult(data);

      await loadHistory();

    } catch (error) {
      console.log(
        "UPLOAD ERROR:",
        error
      );

      Alert.alert(
        "Помилка",
        "Не вдалося виконати аналіз"
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <FlatList
        data={history}

        keyExtractor={(item) =>
          item.id.toString()
        }

        ListHeaderComponent={
          <>
            <Text
              style={styles.title}
            >
              AI Bird Lab
            </Text>

            <Text
              style={styles.subtitle}
            >
              Розпізнавання птахів
              за фотографією
            </Text>

            <Pressable
              style={styles.button}
              onPress={pickImage}
            >
              <Text
                style={
                  styles.buttonText
                }
              >
                Обрати фотографію
              </Text>
            </Pressable>

            {imageUri && (
              <Image
                source={{
                  uri: imageUri,
                }}
                style={styles.image}
              />
            )}

            <Pressable
              style={[
                styles.button,

                !imageUri &&
                  styles.disabledButton,
              ]}

              onPress={
                analyzeImage
              }

              disabled={
                !imageUri ||
                loading
              }
            >
              <Text
                style={
                  styles.buttonText
                }
              >
                {loading
                  ? "Аналіз..."
                  : "Проаналізувати"}
              </Text>
            </Pressable>

            {loading && (
              <ActivityIndicator
                size="large"
                style={
                  styles.loader
                }
              />
            )}

            {result && (
              <View
                style={
                  styles.resultBox
                }
              >
                <Text
                  style={
                    styles.resultTitle
                  }
                >
                  Результат
                </Text>

                <Text
                  style={
                    styles.species
                  }
                >
                  {
                    result
                      .savedBird
                      .predictedSpecies
                  }
                </Text>

                <Text
                  style={
                    styles.text
                  }
                >
                  Впевненість:{" "}
                  {(
                    result
                      .savedBird
                      .confidence *
                    100
                  ).toFixed(2)}
                  %
                </Text>

                <Text
                  style={
                    styles.topTitle
                  }
                >
                  Top 3
                </Text>

                {result
                  .predictions
                  .map(
                    (
                      prediction,
                      index
                    ) => (
                      <Text
                        key={
                          index
                        }
                        style={
                          styles.text
                        }
                      >
                        {index + 1}.{" "}
                        {
                          prediction
                            .species
                        }
                        {" — "}
                        {(
                          prediction
                            .confidence *
                          100
                        ).toFixed(
                          2
                        )}
                        %
                      </Text>
                    )
                  )}
              </View>
            )}

            <Text
              style={
                styles
                  .historyTitle
              }
            >
              Історія аналізів
            </Text>
          </>
        }

        renderItem={({ item }) => (
          <View
            style={styles.card}
          >
            <Text
              style={
                styles.cardTitle
              }
            >
              {
                item
                  .predictedSpecies
              }
            </Text>

            <Text
              style={styles.text}
            >
              Фото:{" "}
              {item.imageName}
            </Text>

            <Text
              style={styles.text}
            >
              Впевненість:{" "}
              {(
                item.confidence *
                100
              ).toFixed(2)}
              %
            </Text>

            <Text
              style={styles.text}
            >
              Дата:{" "}
              {new Date(
                item.analysisDate
              ).toLocaleString()}
            </Text>
          </View>
        )}

        ListEmptyComponent={
          <Text
            style={styles.empty}
          >
            Історія поки
            порожня
          </Text>
        }

        contentContainerStyle={
          styles.content
        }
      />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#eef4ef",
    },

    content: {
      padding: 20,
      paddingBottom: 50,
    },

    title: {
      fontSize: 34,
      fontWeight: "bold",
      textAlign: "center",
      marginTop: 20,
    },

    subtitle: {
      textAlign: "center",
      color: "#555",
      marginTop: 8,
      marginBottom: 25,
    },

    button: {
      backgroundColor:
        "#2f7d4a",
      padding: 14,
      borderRadius: 10,
      alignItems: "center",
      marginBottom: 15,
    },

    disabledButton: {
      backgroundColor:
        "#9aa59d",
    },

    buttonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },

    image: {
      width: "100%",
      height: 230,
      borderRadius: 14,
      marginBottom: 15,
    },

    loader: {
      marginVertical: 20,
    },

    resultBox: {
      backgroundColor:
        "white",
      padding: 20,
      borderRadius: 14,
      marginTop: 10,
    },

    resultTitle: {
      fontSize: 20,
      fontWeight: "bold",
    },

    species: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#2f7d4a",
      marginTop: 10,
      marginBottom: 5,
    },

    topTitle: {
      fontSize: 17,
      fontWeight: "bold",
      marginTop: 15,
      marginBottom: 5,
    },

    historyTitle: {
      fontSize: 23,
      fontWeight: "bold",
      marginTop: 30,
      marginBottom: 15,
    },

    card: {
      backgroundColor:
        "white",
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
    },

    cardTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#2f7d4a",
      marginBottom: 5,
    },

    text: {
      fontSize: 15,
      marginBottom: 4,
    },

    empty: {
      textAlign: "center",
      color: "#777",
    },
  });