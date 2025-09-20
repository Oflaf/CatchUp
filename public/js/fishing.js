// Plik: js/fishing.js

class FishingManager {
    /**
     * Konstruktor klasy FishingManager. Inicjalizuje dane o rybach.
     */
    constructor() {
        this.fishData = {};
        this._initializeFishData();
    }

    /**
     * Metoda prywatna do wypełnienia danych o rybach.
     * Tutaj definiujemy wszystkie biomy i ryby, które można w nich złowić.
     * @private
     */
    _initializeFishData() {
        /**
         * Funkcja pomocnicza do parsowania stringa z rozmiarem "min-max" na obiekt.
         * @param {string} sizeStr String w formacie "20-40".
         * @returns {{min: number, max: number}} Obiekt z minimalnym i maksymalnym rozmiarem.
         */
        const parseSize = (sizeStr) => {
            if (!sizeStr || sizeStr.indexOf('-') === -1) {
                const size = parseInt(sizeStr, 10) || 0;
                return { min: size, max: size };
            }
            const parts = sizeStr.split('-').map(s => parseInt(s.trim(), 10));
            return { min: parts[0], max: parts[1] };
        };

        this.fishData = {
            // Zgodnie z Twoim przykładem, używam nazwy 'grassland' z istniejącego kodu, a nie 'greenland'
            'grassland': {
                'perch': {
                    size: parseSize('20-40'),
                    chance: 60, // 60% szansy na spotkanie, jeśli coś złapiemy
                    power: 20   // Wymaga 20/100 siły od gracza
                },
                'pike': {
                    size: parseSize('40-90'),
                    chance: 30,
                    power: 45
                },
                'roach': {
                    size: parseSize('15-25'),
                    chance: 100, // Bardzo pospolita ryba
                    power: 10
                },
                'tuna': {
                    size: parseSize('0'),
                    chance: 0, // Niemożliwa do złowienia
                    power: 0
                }
            },
            'jurassic': {
                'perch': {
                    size: parseSize('20-80'),
                    chance: 10,
                    power: 50
                },
                'tuna': {
                    size: parseSize('40-120'),
                    chance: 50,
                    power: 60
                },
                'megalodon_shark': {
                    size: parseSize('1500-2000'), // Legendarna ryba
                    chance: 1, // Niezwykle rzadka
                    power: 100 // Niemal niemożliwa do wyciągnięcia
                },
                 'ancient_trilobite': {
                    size: parseSize('10-30'),
                    chance: 80,
                    power: 15
                }
            }
            // Możesz tu dodawać kolejne biomy w przyszłości
        };
    }

    /**
     * Zwraca losową rybę, która "ugryzła", na podstawie biomu i szans.
     * Uwzględnia ważone szanse (weighted random selection).
     * @param {string} biomeName Nazwa biomu, w którym odbywa się połów.
     * @returns {object|null} Obiekt ze szczegółami złowionej ryby (nazwa, losowy rozmiar, siła) lub null, jeśli nic nie złowiono.
     */
    getRandomCatch(biomeName) {
        const biomeFish = this.fishData[biomeName];
        if (!biomeFish) {
            console.warn(`[FishingManager] Nie znaleziono danych dla biomu: ${biomeName}`);
            return null;
        }

        // 1. Odfiltruj ryby, których nie da się złowić i stwórz listę kandydatów
        const availableFish = Object.entries(biomeFish)
            .filter(([name, data]) => data.chance > 0)
            .map(([name, data]) => ({ name, ...data }));

        if (availableFish.length === 0) {
            return null; // W tym biomie nie ma ryb do złowienia
        }

        // 2. Oblicz sumę wszystkich "szans"
        const totalChanceWeight = availableFish.reduce((sum, fish) => sum + fish.chance, 0);

        // 3. Wylosuj liczbę od 0 do sumy szans
        let randomPick = Math.random() * totalChanceWeight;

        // 4. Znajdź rybę, która odpowiada wylosowanej wartości
        for (const fish of availableFish) {
            if (randomPick < fish.chance) {
                // Mamy zwycięzcę!
                return {
                    name: fish.name,
                    size: this._generateRandomSize(fish.size),
                    power: fish.power
                };
            }
            // Jeśli nie ta, odejmij jej szansę i przejdź do następnej
            randomPick -= fish.chance;
        }
        
        // Zabezpieczenie, chociaż nie powinno się zdarzyć przy poprawnych danych
        return null;
    }

    /**
     * Generuje losowy rozmiar dla ryby na podstawie jej zdefiniowanego zakresu min-max.
     * @param {{min: number, max: number}} sizeObject Obiekt z minimalnym i maksymalnym rozmiarem.
     * @returns {number} Losowy rozmiar, zaokrąglony do jednego miejsca po przecinku.
     * @private
     */
    _generateRandomSize(sizeObject) {
        if (!sizeObject || sizeObject.min === 0 && sizeObject.max === 0) {
            return 0;
        }
        const randomSize = Math.random() * (sizeObject.max - sizeObject.min) + sizeObject.min;
        return parseFloat(randomSize.toFixed(1));
    }
    
    /**
     * Zwraca wszystkie dane o rybach dla danego biomu.
     * Może być przydatne do encyklopedii ryb w grze.
     * @param {string} biomeName Nazwa biomu.
     * @returns {object|null} Obiekt z rybami lub null, jeśli biom nie istnieje.
     */
    getFishForBiome(biomeName) {
        return this.fishData[biomeName] || null;
    }
}