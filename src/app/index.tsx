
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
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
    const API = "http://192.168.31.11:5000";

    const [walletAddress, setWalletAddress] = useState("");
    const [registered, setRegistered] = useState(false);
    const [checkingWallet, setCheckingWallet] = useState(false);

    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageName, setImageName] = useState("bird.jpg");
    const [imageType, setImageType] = useState("image/jpeg");

    const [result, setResult] = useState<AnalyzeResponse | null>(null);
    const [history, setHistory] = useState<Bird[]>([]);

    const [loading, setLoading] = useState(false);

    async function loadHistory() {
        try {
            const response = await fetch(`${API}/api/Birds`);

            console.log("HISTORY STATUS:", response.status);

            if (!response.ok) {
                console.log("HISTORY ERROR:", await response.text());
                return;
            }

            const data: Bird[] = await response.json();
            setHistory(data);
        } catch (error) {
            console.log("HISTORY ERROR:", error);
        }
    }

    useEffect(() => {
        loadHistory();
    }, []);

    
    async function checkWallet() {
        const address = walletAddress.trim();

        if (!address) {
            Alert.alert("Помилка", "Введіть адресу MetaMask");
            return;
        }

        try {
            setCheckingWallet(true);
            setRegistered(false);

            const response = await fetch(
                `${API}/api/Crypto/check/${address}`
            );

            console.log("CRYPTO STATUS:", response.status);

            if (!response.ok) {
                const errorText = await response.text();

                console.log("CRYPTO ERROR:", errorText);

                Alert.alert(
                    "Помилка",
                    `Не вдалося перевірити гаманець. HTTP ${response.status}`
                );
                return;
            }

            const data = await response.json();

            console.log("CRYPTO RESPONSE:", data);

            setRegistered(data.registered === true);

            if (data.registered === true) {
                Alert.alert("Готово", "Доступ активний");
            } else {
                Alert.alert(
                    "Немає доступу",
                    "Гаманець ще не зареєстрований у смартконтракті"
                );
            }
        } catch (error) {
            console.log("CRYPTO NETWORK ERROR:", error);

            Alert.alert(
                "Помилка",
                error instanceof Error
                    ? error.message
                    : "Не вдалося підключитися до сервера"
            );
        } finally {
            setCheckingWallet(false);
        }
    }

    
    async function pickImage() {
        try {
            const pickerResult =
                await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    allowsEditing: false,
                    quality: 1,
                });

            if (pickerResult.canceled) {
                return;
            }

            const asset = pickerResult.assets[0];

            if (!asset) {
                Alert.alert("Помилка", "Фото не вибрано");
                return;
            }

            const converted = await ImageManipulator.manipulateAsync(
                asset.uri,
                [],
                {
                    compress: 0.8,
                    format: ImageManipulator.SaveFormat.JPEG,
                }
            );

            setImageUri(converted.uri);
            setImageName("bird.jpg");
            setImageType("image/jpeg");

            setResult(null);

            console.log("SELECTED IMAGE:", {
                uri: asset.uri,
                fileName: asset.fileName,
                mimeType: asset.mimeType,
            });
        } catch (error) {
            console.log("IMAGE PICKER ERROR:", error);

            Alert.alert("Помилка", "Не вдалося вибрати фото");
        }
    }

    
    async function analyzeImage() {
        if (!registered) {
            Alert.alert(
                "Немає доступу",
                "Спочатку перевірте зареєстрований гаманець"
            );
            return;
        }

        if (!imageUri) {
            Alert.alert("Помилка", "Спочатку виберіть фото");
            return;
        }

        try {
            setLoading(true);
            setResult(null);

            const imageResponse = await fetch(imageUri);
            const imageBlob = await imageResponse.blob();

            const formData = new FormData();
            formData.append("file", imageBlob, imageName);

            console.log("ANALYZE START");
            console.log("ANALYZE URL:", `${API}/api/Birds/analyze`);
            console.log("IMAGE NAME:", imageName);
            console.log("IMAGE TYPE:", imageType);

            const response = await fetch(`${API}/api/Birds/analyze`, {
                method: "POST",
                body: formData,
            });

            console.log("ANALYZE STATUS:", response.status);

            const responseText = await response.text();

            console.log("ANALYZE RESPONSE:", responseText);

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${responseText.slice(0, 300)}`
                );
            }

            let data: AnalyzeResponse;

            try {
                data = JSON.parse(responseText);
            } catch {
                throw new Error(
                    "Сервер повернув відповідь, яку не вдалося прочитати як JSON"
                );
            }

            if (
                !data ||
                !data.savedBird ||
                !Array.isArray(data.predictions)
            ) {
                throw new Error(
                    "Сервер повернув неправильну структуру результату аналізу"
                );
            }

            setResult(data);

            console.log("ANALYZE SUCCESS:", data);

            await loadHistory();

            Alert.alert(
                "Аналіз завершено",
                `Птах: ${data.savedBird.predictedSpecies}`
            );
        } catch (error) {
            console.log("ANALYZE ERROR:", error);

            Alert.alert(
                "Помилка аналізу",
                error instanceof Error
                    ? error.message
                    : String(error)
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <FlatList
                data={history}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.container}
                ListHeaderComponent={
                    <>
                        <Text style={styles.title}>AI Bird Lab</Text>

                        <Text style={styles.subtitle}>
                            Мобільний AI-аналіз птахів
                        </Text>

                       
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Crypto доступ</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="0x... адреса MetaMask"
                                placeholderTextColor="#999"
                                value={walletAddress}
                                onChangeText={(text) => {
                                    setWalletAddress(text);
                                    setRegistered(false);
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    checkingWallet && styles.disabledButton,
                                ]}
                                onPress={checkWallet}
                                disabled={checkingWallet}
                            >
                                <Text style={styles.buttonText}>
                                    {checkingWallet
                                        ? "Перевірка..."
                                        : "Перевірити гаманець"}
                                </Text>
                            </TouchableOpacity>

                            {registered ? (
                                <Text style={styles.success}>
                                     Доступ активний
                                </Text>
                            ) : (
                                <Text style={styles.error}>
                                    ❌ Доступ не підтверджено
                                </Text>
                            )}
                        </View>

                     
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Фото птаха</Text>

                            <TouchableOpacity
                                style={styles.button}
                                onPress={pickImage}
                            >
                                <Text style={styles.buttonText}>
                                    Вибрати фото
                                </Text>
                            </TouchableOpacity>

                            {imageUri && (
                                <Image
                                    source={{ uri: imageUri }}
                                    style={styles.image}
                                />
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    (!registered || !imageUri || loading) &&
                                    styles.disabledButton,
                                ]}
                                onPress={analyzeImage}
                                disabled={!registered || !imageUri || loading}
                            >
                                <Text style={styles.buttonText}>
                                    {loading ? "Аналіз..." : "Проаналізувати"}
                                </Text>
                            </TouchableOpacity>

                            {loading && (
                                <ActivityIndicator
                                    size="large"
                                    style={styles.loader}
                                />
                            )}
                        </View>

                        
                        {result && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>
                                    Результат аналізу
                                </Text>

                                <Text style={styles.species}>
                                    {result.savedBird.predictedSpecies}
                                </Text>

                                <Text style={styles.text}>
                                    Впевненість:{" "}
                                    {(result.savedBird.confidence * 100).toFixed(2)}%
                                </Text>

                                <Text style={styles.topTitle}>Top 3</Text>

                                {result.predictions.map((prediction, index) => (
                                    <Text
                                        key={index}
                                        style={styles.prediction}
                                    >
                                        {index + 1}. {prediction.species} —{" "}
                                        {(prediction.confidence * 100).toFixed(2)}%
                                    </Text>
                                ))}
                            </View>
                        )}

                        <Text style={styles.historyTitle}>
                            Історія аналізів
                        </Text>
                    </>
                }
                renderItem={({ item }) => (
                    <View style={styles.historyCard}>
                        <Text style={styles.species}>
                            {item.predictedSpecies}
                        </Text>

                        <Text style={styles.text}>
                            Фото: {item.imageName}
                        </Text>

                        <Text style={styles.text}>
                            Впевненість:{" "}
                            {(item.confidence * 100).toFixed(2)}%
                        </Text>

                        <Text style={styles.text}>
                            Дата:{" "}
                            {new Date(item.analysisDate).toLocaleString()}
                        </Text>

                        <Text style={styles.text}>
                            Опис: {item.description}
                        </Text>
                    </View>
                )}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        Історія поки порожня
                    </Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#eef4ef",
    },

    container: {
        padding: 20,
        paddingBottom: 50,
    },

    title: {
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center",
        marginTop: 15,
    },

    subtitle: {
        textAlign: "center",
        color: "#666",
        marginTop: 5,
        marginBottom: 25,
    },

    card: {
        backgroundColor: "#fff",
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
    },

    cardTitle: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 15,
    },

    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        fontSize: 15,
    },

    button: {
        backgroundColor: "#2f7d4a",
        paddingVertical: 13,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: "center",
        marginVertical: 6,
    },

    disabledButton: {
        backgroundColor: "#999",
    },

    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    success: {
        color: "#2f7d4a",
        fontWeight: "bold",
        textAlign: "center",
        marginTop: 10,
    },

    error: {
        color: "#c0392b",
        fontWeight: "bold",
        textAlign: "center",
        marginTop: 10,
    },

    image: {
        width: "100%",
        height: 260,
        borderRadius: 12,
        marginVertical: 15,
        resizeMode: "cover",
    },

    loader: {
        marginTop: 15,
    },

    species: {
        fontSize: 19,
        fontWeight: "bold",
        color: "#2f7d4a",
        textAlign: "center",
        marginBottom: 10,
    },

    text: {
        fontSize: 15,
        marginVertical: 3,
    },

    topTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 18,
        marginBottom: 8,
    },

    prediction: {
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },

    historyTitle: {
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        marginVertical: 20,
    },

    historyCard: {
        backgroundColor: "#fff",
        padding: 18,
        borderRadius: 14,
        marginBottom: 12,
    },

    empty: {
        textAlign: "center",
        color: "#666",
    },
});
