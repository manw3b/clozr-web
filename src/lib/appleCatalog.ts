/**
 * Catálogo Apple (template) para el picker visual de Inventario.
 * GENERADO desde clozr/src/lib/db/quickStock.ts (seedAppleCatalog + IPHONE_SEED + IPAD_SEED).
 * iPhone/iPad salen de los ProductSeed (fuente de verdad); Watch/Mac/AirPods del SQL inline.
 * Familias/categorías vacías podadas. Imágenes -> /products/... (public/products).
 * NO editar a mano — regenerar con el parser si cambia el seed del desktop.
 */

export interface CatColor { color: string; colorHex: string | null; image: string | null }
export interface CatModel { id: string; name: string; image: string | null; colors: CatColor[]; storages: string[] }
export interface CatFamily { id: string; name: string; models: CatModel[] }
export interface CatCategory { id: string; name: string; emoji: string | null; families: CatFamily[] }

export const APPLE_CATALOG: CatCategory[] = [
  {
    "id": "cat-iphone",
    "name": "iPhone",
    "emoji": "📱",
    "families": [
      {
        "id": "fam-17",
        "name": "iPhone 17",
        "models": [
          {
            "id": "mod-17promax",
            "name": "iPhone 17 Pro Max",
            "image": "/products/iphones/iPhone_17_Pro_Max_Cosmic_Orange.jpg",
            "colors": [
              {
                "color": "Cosmic Orange",
                "colorHex": "#D4621A",
                "image": "/products/iphones/iPhone_17_Pro_Max_Cosmic_Orange.jpg"
              },
              {
                "color": "Deep Blue",
                "colorHex": "#1B3A6B",
                "image": "/products/iphones/iPhone_17_Pro_Max_Deep_Blue.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_17_Pro_Max_Silver.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB",
              "2TB"
            ]
          },
          {
            "id": "mod-17pro",
            "name": "iPhone 17 Pro",
            "image": "/products/iphones/iPhone_17_Pro_Cosmic_Orange.jpg",
            "colors": [
              {
                "color": "Cosmic Orange",
                "colorHex": "#D4621A",
                "image": "/products/iphones/iPhone_17_Pro_Cosmic_Orange.jpg"
              },
              {
                "color": "Deep Blue",
                "colorHex": "#1B3A6B",
                "image": "/products/iphones/iPhone_17_Pro_Deep_Blue.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_17_Pro_Silver.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-air",
            "name": "iPhone Air",
            "image": "/products/iphones/iPhone_Air_Sky_Blue.jpg",
            "colors": [
              {
                "color": "Space Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_Air_Space_Black.jpg"
              },
              {
                "color": "Cloud White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_Air_Cloud_White.jpg"
              },
              {
                "color": "Light Gold",
                "colorHex": "#E8D5A3",
                "image": "/products/iphones/iPhone_Air_Light_Gold.jpg"
              },
              {
                "color": "Sky Blue",
                "colorHex": "#8BBCD4",
                "image": "/products/iphones/iPhone_Air_Sky_Blue.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-17",
            "name": "iPhone 17",
            "image": "/products/iphones/iPhone_17_Mist_Blue.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_17_Black.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_17_White.jpg"
              },
              {
                "color": "Mist Blue",
                "colorHex": "#A8C4D4",
                "image": "/products/iphones/iPhone_17_Mist_Blue.jpg"
              },
              {
                "color": "Sage",
                "colorHex": "#8FAF8C",
                "image": "/products/iphones/iPhone_17_Sage.jpg"
              },
              {
                "color": "Lavender",
                "colorHex": "#C4B8D4",
                "image": "/products/iphones/iPhone_17_Lavender.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-17e",
            "name": "iPhone 17e",
            "image": "/products/iphones/iPhone_17e_Black.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_17e_Black.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_17e_White.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/iphones/iPhone_17e_Pink.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-16",
        "name": "iPhone 16",
        "models": [
          {
            "id": "mod-16promax",
            "name": "iPhone 16 Pro Max",
            "image": "/products/iphones/iPhone_16_Pro_Max_Black_Titanium.jpg",
            "colors": [
              {
                "color": "Black Titanium",
                "colorHex": "#2C2C2C",
                "image": "/products/iphones/iPhone_16_Pro_Max_Black_Titanium.jpg"
              },
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/iphones/iPhone_16_Pro_Max_Natural_Titanium.jpg"
              },
              {
                "color": "White Titanium",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_16_Pro_Max_White_Titanium.jpg"
              },
              {
                "color": "Desert Titanium",
                "colorHex": "#D4B896",
                "image": "/products/iphones/iPhone_16_Pro_Max_Desert_Titanium.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-16pro",
            "name": "iPhone 16 Pro",
            "image": "/products/iphones/iPhone_16_Pro_Black_Titanium.jpg",
            "colors": [
              {
                "color": "Black Titanium",
                "colorHex": "#2C2C2C",
                "image": "/products/iphones/iPhone_16_Pro_Black_Titanium.jpg"
              },
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/iphones/iPhone_16_Pro_Natural_Titanium.jpg"
              },
              {
                "color": "White Titanium",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_16_Pro_White_Titanium.jpg"
              },
              {
                "color": "Desert Titanium",
                "colorHex": "#D4B896",
                "image": "/products/iphones/iPhone_16_Pro_Desert_Titanium.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-16plus",
            "name": "iPhone 16 Plus",
            "image": "/products/iphones/iPhone_16_Plus_Ultramarine.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_16_Plus_Black.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_16_Plus_White.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/iphones/iPhone_16_Plus_Pink.jpg"
              },
              {
                "color": "Teal",
                "colorHex": "#5B9EA0",
                "image": "/products/iphones/iPhone_16_Plus_Teal.jpg"
              },
              {
                "color": "Ultramarine",
                "colorHex": "#3B5BA5",
                "image": "/products/iphones/iPhone_16_Plus_Ultramarine.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-16",
            "name": "iPhone 16",
            "image": "/products/iphones/iPhone_16_Ultramarine.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_16_Black.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_16_White.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/iphones/iPhone_16_Pink.jpg"
              },
              {
                "color": "Teal",
                "colorHex": "#5B9EA0",
                "image": "/products/iphones/iPhone_16_Teal.jpg"
              },
              {
                "color": "Ultramarine",
                "colorHex": "#3B5BA5",
                "image": "/products/iphones/iPhone_16_Ultramarine.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-16e",
            "name": "iPhone 16e",
            "image": "/products/iphones/iPhone_16e_Black.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_16e_Black.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_16e_White.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-15",
        "name": "iPhone 15",
        "models": [
          {
            "id": "mod-15promax",
            "name": "iPhone 15 Pro Max",
            "image": "/products/iphones/iPhone_15_Pro_Max_Natural_Titanium.jpg",
            "colors": [
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/iphones/iPhone_15_Pro_Max_Natural_Titanium.jpg"
              },
              {
                "color": "Black Titanium",
                "colorHex": "#2C2C2C",
                "image": "/products/iphones/iPhone_15_Pro_Max_Black_Titanium.jpg"
              },
              {
                "color": "Blue Titanium",
                "colorHex": "#4D5C73",
                "image": "/products/iphones/iPhone_15_Pro_Max_Blue_Titanium.jpg"
              },
              {
                "color": "White Titanium",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_15_Pro_Max_White_Titanium.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-15pro",
            "name": "iPhone 15 Pro",
            "image": "/products/iphones/iPhone_15_Pro_Natural_Titanium.jpg",
            "colors": [
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/iphones/iPhone_15_Pro_Natural_Titanium.jpg"
              },
              {
                "color": "Black Titanium",
                "colorHex": "#2C2C2C",
                "image": "/products/iphones/iPhone_15_Pro_Black_Titanium.jpg"
              },
              {
                "color": "Blue Titanium",
                "colorHex": "#4D5C73",
                "image": "/products/iphones/iPhone_15_Pro_Blue_Titanium.jpg"
              },
              {
                "color": "White Titanium",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_15_Pro_White_Titanium.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-15plus",
            "name": "iPhone 15 Plus",
            "image": "/products/iphones/iPhone_15_Plus_Pink.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_15_Plus_Black.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#A8C4DC",
                "image": "/products/iphones/iPhone_15_Plus_Blue.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#A8C8B0",
                "image": "/products/iphones/iPhone_15_Plus_Green.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2C8D0",
                "image": "/products/iphones/iPhone_15_Plus_Pink.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E8A8",
                "image": "/products/iphones/iPhone_15_Plus_Yellow.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-15",
            "name": "iPhone 15",
            "image": "/products/iphones/iPhone_15_Pink.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_15_Black.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#A8C4DC",
                "image": "/products/iphones/iPhone_15_Blue.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#A8C8B0",
                "image": "/products/iphones/iPhone_15_Green.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2C8D0",
                "image": "/products/iphones/iPhone_15_Pink.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E8A8",
                "image": "/products/iphones/iPhone_15_Yellow.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          }
        ]
      },
      {
        "id": "fam-14",
        "name": "iPhone 14",
        "models": [
          {
            "id": "mod-14promax",
            "name": "iPhone 14 Pro Max",
            "image": "/products/iphones/iPhone_14_Pro_Max_Deep_Purple.jpg",
            "colors": [
              {
                "color": "Deep Purple",
                "colorHex": "#4B3F72",
                "image": "/products/iphones/iPhone_14_Pro_Max_Deep_Purple.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_14_Pro_Max_Gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_14_Pro_Max_Silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_14_Pro_Max_Space_Black.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-14pro",
            "name": "iPhone 14 Pro",
            "image": "/products/iphones/iPhone_14_Pro_Deep_Purple.jpg",
            "colors": [
              {
                "color": "Deep Purple",
                "colorHex": "#4B3F72",
                "image": "/products/iphones/iPhone_14_Pro_Deep_Purple.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_14_Pro_Gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_14_Pro_Silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_14_Pro_Space_Black.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-14plus",
            "name": "iPhone 14 Plus",
            "image": "/products/iphones/iPhone_14_Plus_Purple.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#A8C4DC",
                "image": "/products/iphones/iPhone_14_Plus_Blue.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_14_Plus_Midnight.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#C4B8D4",
                "image": "/products/iphones/iPhone_14_Plus_Purple.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_14_Plus_Red.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/iphones/iPhone_14_Plus_Starlight.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E8A8",
                "image": "/products/iphones/iPhone_14_Plus_Yellow.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-14",
            "name": "iPhone 14",
            "image": "/products/iphones/iPhone_14_Purple.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#A8C4DC",
                "image": "/products/iphones/iPhone_14_Blue.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_14_Midnight.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#C4B8D4",
                "image": "/products/iphones/iPhone_14_Purple.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_14_Red.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/iphones/iPhone_14_Starlight.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E8A8",
                "image": "/products/iphones/iPhone_14_Yellow.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          }
        ]
      },
      {
        "id": "fam-13",
        "name": "iPhone 13",
        "models": [
          {
            "id": "mod-13promax",
            "name": "iPhone 13 Pro Max",
            "image": "/products/iphones/iPhone_13_Pro_Max_Sierra_Blue.jpg",
            "colors": [
              {
                "color": "Alpine Green",
                "colorHex": "#576856",
                "image": "/products/iphones/iPhone_13_Pro_Max_Alpine_Green.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_13_Pro_Max_Gold.jpg"
              },
              {
                "color": "Graphite",
                "colorHex": "#54524F",
                "image": "/products/iphones/iPhone_13_Pro_Max_Graphite.jpg"
              },
              {
                "color": "Sierra Blue",
                "colorHex": "#A0B8CC",
                "image": "/products/iphones/iPhone_13_Pro_Max_Sierra_Blue.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_13_Pro_Max_Silver.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-13pro",
            "name": "iPhone 13 Pro",
            "image": "/products/iphones/iPhone_13_Pro_Sierra_Blue.jpg",
            "colors": [
              {
                "color": "Alpine Green",
                "colorHex": "#576856",
                "image": "/products/iphones/iPhone_13_Pro_Alpine_Green.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_13_Pro_Gold.jpg"
              },
              {
                "color": "Graphite",
                "colorHex": "#54524F",
                "image": "/products/iphones/iPhone_13_Pro_Graphite.jpg"
              },
              {
                "color": "Sierra Blue",
                "colorHex": "#A0B8CC",
                "image": "/products/iphones/iPhone_13_Pro_Sierra_Blue.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_13_Pro_Silver.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-13",
            "name": "iPhone 13",
            "image": "/products/iphones/iPhone_13_Pink.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#A8C4DC",
                "image": "/products/iphones/iPhone_13_Blue.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#5C8FAF",
                "image": "/products/iphones/iPhone_13_Green.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_13_Midnight.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2C8D0",
                "image": "/products/iphones/iPhone_13_Pink.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_13_Product_Red.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/iphones/iPhone_13_Starlight.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-13mini",
            "name": "iPhone 13 mini",
            "image": "/products/iphones/iPhone_13_Mini_Pink.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#A8C4DC",
                "image": "/products/iphones/iPhone_13_Mini_Blue.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#5C8FAF",
                "image": "/products/iphones/iPhone_13_Mini_Green.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_13_Mini_Midnight.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2C8D0",
                "image": "/products/iphones/iPhone_13_Mini_Pink.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_13_Mini_Product_Red.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/iphones/iPhone_13_Mini_Starlight.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          }
        ]
      },
      {
        "id": "fam-12",
        "name": "iPhone 12",
        "models": [
          {
            "id": "mod-12promax",
            "name": "iPhone 12 Pro Max",
            "image": "/products/iphones/iPhone_12_Pro_Max_Pacific_Blue.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_12_Pro_Max_Gold.jpg"
              },
              {
                "color": "Graphite",
                "colorHex": "#54524F",
                "image": "/products/iphones/iPhone_12_Pro_Max_Graphite.jpg"
              },
              {
                "color": "Pacific Blue",
                "colorHex": "#2E6B9E",
                "image": "/products/iphones/iPhone_12_Pro_Max_Pacific_Blue.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_12_Pro_Max_Silver.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-12pro",
            "name": "iPhone 12 Pro",
            "image": "/products/iphones/iPhone_12_Pro_Pacific_Blue.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_12_Pro_Gold.jpg"
              },
              {
                "color": "Graphite",
                "colorHex": "#54524F",
                "image": "/products/iphones/iPhone_12_Pro_Graphite.jpg"
              },
              {
                "color": "Pacific Blue",
                "colorHex": "#2E6B9E",
                "image": "/products/iphones/iPhone_12_Pro_Pacific_Blue.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_12_Pro_Silver.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-12",
            "name": "iPhone 12",
            "image": "/products/iphones/iPhone_12_Purple.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_12_Black.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#3D5078",
                "image": "/products/iphones/iPhone_12_Blue.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#A0C8B0",
                "image": "/products/iphones/iPhone_12_Green.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#C4B0D8",
                "image": "/products/iphones/iPhone_12_Purple.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_12_Red.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_12_White.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          },
          {
            "id": "mod-12mini",
            "name": "iPhone 12 mini",
            "image": "/products/iphones/iPhone_12_Mini_Purple.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_12_Mini_Black.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#3D5078",
                "image": "/products/iphones/iPhone_12_Mini_Blue.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#A0C8B0",
                "image": "/products/iphones/iPhone_12_Mini_Green.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#C4B0D8",
                "image": "/products/iphones/iPhone_12_Mini_Purple.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_12_Mini_Red.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_12_Mini_White.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-11",
        "name": "iPhone 11",
        "models": [
          {
            "id": "mod-11promax",
            "name": "iPhone 11 Pro Max",
            "image": "/products/iphones/iPhone_11_Pro_Max_Midnightgreen.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_11_Pro_Max_Gold.jpg"
              },
              {
                "color": "Midnight Green",
                "colorHex": "#3D5A4C",
                "image": "/products/iphones/iPhone_11_Pro_Max_Midnightgreen.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_11_Pro_Max_Silver.jpg"
              },
              {
                "color": "Space Grey",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_11_Pro_Max_Spacegrey.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-11pro",
            "name": "iPhone 11 Pro",
            "image": "/products/iphones/iPhone_11_Pro_Midnightgreen.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_11_Pro_Gold.jpg"
              },
              {
                "color": "Midnight Green",
                "colorHex": "#3D5A4C",
                "image": "/products/iphones/iPhone_11_Pro_Midnightgreen.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_11_Pro_Silver.jpg"
              },
              {
                "color": "Space Grey",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_11_Pro_Spacegrey.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-11",
            "name": "iPhone 11",
            "image": "/products/iphones/iPhone_11_Purple.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_11_Black.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#B0D4B0",
                "image": "/products/iphones/iPhone_11_Green.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#D4B8D8",
                "image": "/products/iphones/iPhone_11_Purple.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_11_Red.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_11_White.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E08A",
                "image": "/products/iphones/iPhone_11_Yellow.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-x",
        "name": "iPhone X Series",
        "models": [
          {
            "id": "mod-xsmax",
            "name": "iPhone XS Max",
            "image": "/products/iphones/iPhone_XS_Max_Spacegray.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_XS_Max_Gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_XS_Max_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_XS_Max_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-xs",
            "name": "iPhone XS",
            "image": "/products/iphones/iPhone_XS_Spacegray.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/iphones/iPhone_XS_Gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_XS_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_XS_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-xr",
            "name": "iPhone XR",
            "image": "/products/iphones/iPhone_XR_Coral.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_XR_Black.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#5C84B5",
                "image": "/products/iphones/iPhone_XR_Blue.jpg"
              },
              {
                "color": "Coral",
                "colorHex": "#E89682",
                "image": "/products/iphones/iPhone_XR_Coral.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_XR_Red.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_XR_White.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E08A",
                "image": "/products/iphones/iPhone_XR_Yellow.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          },
          {
            "id": "mod-x",
            "name": "iPhone X",
            "image": "/products/iphones/iPhone_X_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_X_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_X_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-se",
        "name": "iPhone SE",
        "models": [
          {
            "id": "mod-se3",
            "name": "iPhone SE (3rd Gen)",
            "image": "/products/iphones/iPhone_SE_3rd_Gen_Starlight.jpg",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_SE_3rd_Gen_Midnight.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_SE_3rd_Gen_Red.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/iphones/iPhone_SE_3rd_Gen_Starlight.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          },
          {
            "id": "mod-se2",
            "name": "iPhone SE (2nd Gen)",
            "image": "/products/iphones/iPhone_SE_2nd_Gen_White.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_SE_2nd_Gen_Black.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": "/products/iphones/iPhone_SE_2nd_Gen_Red.jpg"
              },
              {
                "color": "White",
                "colorHex": "#F5F5F0",
                "image": "/products/iphones/iPhone_SE_2nd_Gen_White.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-8",
        "name": "iPhone 8",
        "models": [
          {
            "id": "mod-8plus",
            "name": "iPhone 8 Plus",
            "image": "/products/iphones/iPhone_8_Plus_Gold.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/iphones/iPhone_8_Plus_Gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_8_Plus_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_8_Plus_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          },
          {
            "id": "mod-8",
            "name": "iPhone 8",
            "image": "/products/iphones/iPhone_8_Gold.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/iphones/iPhone_8_Gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_8_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/iphones/iPhone_8_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-7",
        "name": "iPhone 7",
        "models": [
          {
            "id": "mod-7plus",
            "name": "iPhone 7 Plus",
            "image": "/products/iphones/iPhone_7_Plus_Rosegold.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_7_Plus_Black.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/iphones/iPhone_7_Plus_Gold.jpg"
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B5A8",
                "image": "/products/iphones/iPhone_7_Plus_Rosegold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_7_Plus_Silver.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB",
              "256GB"
            ]
          },
          {
            "id": "mod-7",
            "name": "iPhone 7",
            "image": "/products/iphones/iPhone_7_Rosegold.jpg",
            "colors": [
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": "/products/iphones/iPhone_7_Black.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/iphones/iPhone_7_Gold.jpg"
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B5A8",
                "image": "/products/iphones/iPhone_7_Rosegold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/iphones/iPhone_7_Silver.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB",
              "256GB"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "cat-ipad",
    "name": "iPad",
    "emoji": "📲",
    "families": [
      {
        "id": "fam-ipadpro",
        "name": "iPad Pro",
        "models": [
          {
            "id": "mod-ipadpro13m5",
            "name": "iPad Pro 13 M5",
            "image": "/products/ipads/iPad_Pro_13_M5_Spaceblack.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_13_M5_Silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C1E",
                "image": "/products/ipads/iPad_Pro_13_M5_Spaceblack.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-ipadpro13m4",
            "name": "iPad Pro 13 M4",
            "image": "/products/ipads/iPad_Pro_13_M4_Spaceblack.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_13_M4_Silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C1E",
                "image": "/products/ipads/iPad_Pro_13_M4_Spaceblack.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-ipadpro11m4",
            "name": "iPad Pro 11 M4",
            "image": "/products/ipads/iPad_Pro_11_M4_Spaceblack.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_11_M4_Silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C1E",
                "image": "/products/ipads/iPad_Pro_11_M4_Spaceblack.jpg"
              }
            ],
            "storages": [
              "256GB",
              "512GB",
              "1TB"
            ]
          },
          {
            "id": "mod-ipadpro12-6",
            "name": "iPad Pro 12 6th Gen",
            "image": "/products/ipads/iPad_Pro_12_6th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_12_6th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_12_6th_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro11-4",
            "name": "iPad Pro 11 4th Gen",
            "image": "/products/ipads/iPad_Pro_11_4th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_11_4th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_11_4th_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro12-5",
            "name": "iPad Pro 12 5th Gen",
            "image": "/products/ipads/iPad_Pro_12_5th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_12_5th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_12_5th_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro11-3",
            "name": "iPad Pro 11 3rd Gen",
            "image": "/products/ipads/iPad_Pro_11_3rd_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_11_3rd_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_11_3rd_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro12-4",
            "name": "iPad Pro 12 4th Gen",
            "image": "/products/ipads/iPad_Pro_12_4th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_12_4th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_12_4th_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro11-2",
            "name": "iPad Pro 11 2nd Gen",
            "image": "/products/ipads/iPad_Pro_11_2nd_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_11_2nd_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_11_2nd_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro12-3",
            "name": "iPad Pro 12 3rd Gen",
            "image": "/products/ipads/iPad_Pro_12_3rd_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_12_3rd_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_12_3rd_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro11-1",
            "name": "iPad Pro 11 1st Gen",
            "image": "/products/ipads/iPad_Pro_11_1st_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_11_1st_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_11_1st_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro12-2",
            "name": "iPad Pro 12 2nd Gen",
            "image": "/products/ipads/iPad_Pro_12_2nd_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_12_2nd_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_12_2nd_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Pro_12_2nd_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro12-1",
            "name": "iPad Pro 12 1st Gen",
            "image": "/products/ipads/iPad_Pro_12_1st_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_12_1st_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_12_1st_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Pro_12_1st_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipadpro10",
            "name": "iPad Pro 10",
            "image": "/products/ipads/iPad_Pro_10_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_10_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_10_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Pro_10_Gold.jpg"
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B5A8",
                "image": "/products/ipads/iPad_Pro_10_Rosegold.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadpro9",
            "name": "iPad Pro 9",
            "image": "/products/ipads/iPad_Pro_9_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Pro_9_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Pro_9_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Pro_9_Gold.jpg"
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B5A8",
                "image": "/products/ipads/iPad_Pro_9_Rosegold.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB",
              "256GB"
            ]
          }
        ]
      },
      {
        "id": "fam-ipadair",
        "name": "iPad Air",
        "models": [
          {
            "id": "mod-ipadairm4-13",
            "name": "iPad Air 13 M4",
            "image": "/products/ipads/iPad_Air_13_M4_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_13_M4_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_13_M4_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_13_M4_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_13_M4_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadairm4-11",
            "name": "iPad Air 11 M4",
            "image": "/products/ipads/iPad_Air_11_M4_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_11_M4_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_11_M4_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_11_M4_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_11_M4_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadairm3-13",
            "name": "iPad Air 13 M3",
            "image": "/products/ipads/iPad_Air_13_M3_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_13_M3_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_13_M3_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_13_M3_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_13_M3_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadairm3-11",
            "name": "iPad Air 11 M3",
            "image": "/products/ipads/iPad_Air_11_M3_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_11_M3_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_11_M3_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_11_M3_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_11_M3_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadairm2-13",
            "name": "iPad Air 13 M2",
            "image": "/products/ipads/iPad_Air_13_M2_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_13_M2_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_13_M2_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_13_M2_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_13_M2_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadairm2-11",
            "name": "iPad Air 11 M2",
            "image": "/products/ipads/iPad_Air_11_M2_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_11_M2_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_11_M2_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_11_M2_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_11_M2_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadair5",
            "name": "iPad Air 5th Gen",
            "image": "/products/ipads/iPad_Air_5th_Gen_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Air_5th_Gen_Blue.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/ipads/iPad_Air_5th_Gen_Pink.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Air_5th_Gen_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Air_5th_Gen_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_5th_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipadair4",
            "name": "iPad Air 4th Gen",
            "image": "/products/ipads/iPad_Air_4th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Air_4th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_4th_Gen_Spacegray.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#95B8A6",
                "image": "/products/ipads/iPad_Air_4th_Gen_Green.jpg"
              },
              {
                "color": "Sky Blue",
                "colorHex": "#B5D7E5",
                "image": "/products/ipads/iPad_Air_4th_Gen_Skyblue.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Air_4th_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipadair3",
            "name": "iPad Air 3rd Gen",
            "image": "/products/ipads/iPad_Air_3rd_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Air_3rd_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_3rd_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Air_3rd_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipadair2",
            "name": "iPad Air 2",
            "image": "/products/ipads/iPad_Air_2_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Air_2_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_2_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Air_2_Gold.jpg"
              }
            ],
            "storages": [
              "16GB",
              "64GB",
              "128GB"
            ]
          },
          {
            "id": "mod-ipadair1",
            "name": "iPad Air 1st Gen",
            "image": "/products/ipads/iPad_Air_1st_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Air_1st_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Air_1st_Gen_Spacegray.jpg"
              }
            ],
            "storages": [
              "16GB",
              "32GB",
              "64GB",
              "128GB"
            ]
          }
        ]
      },
      {
        "id": "fam-ipadmini",
        "name": "iPad mini",
        "models": [
          {
            "id": "mod-ipadmini7",
            "name": "iPad Mini A17 Pro",
            "image": "/products/ipads/iPad_Mini_A17_Pro_Blue.jpg",
            "colors": [
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_Mini_A17_Pro_Blue.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Mini_A17_Pro_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Mini_A17_Pro_Starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Mini_A17_Pro_Spacegray.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipadmini6",
            "name": "iPad Mini 6th Gen",
            "image": "/products/ipads/iPad_Mini_6th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Mini_6th_Gen_Spacegray.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/ipads/iPad_Mini_6th_Gen_Pink.jpg"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/ipads/iPad_Mini_6th_Gen_Purple.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/ipads/iPad_Mini_6th_Gen_Starlight.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipadmini5",
            "name": "iPad Mini 5th Gen",
            "image": "/products/ipads/iPad_Mini_5th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Mini_5th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Mini_5th_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Mini_5th_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipadmini4",
            "name": "iPad Mini 4",
            "image": "/products/ipads/iPad_Mini_4_Spacegray.png",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Mini_4_Silver.png"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Mini_4_Spacegray.png"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Mini_4_Gold.png"
              }
            ],
            "storages": [
              "16GB",
              "64GB",
              "128GB"
            ]
          },
          {
            "id": "mod-ipadmini3",
            "name": "iPad Mini 3",
            "image": "/products/ipads/iPad_Mini_3_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Mini_3_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Mini_3_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_Mini_3_Gold.jpg"
              }
            ],
            "storages": [
              "16GB",
              "64GB",
              "128GB"
            ]
          },
          {
            "id": "mod-ipadmini2",
            "name": "iPad Mini 2",
            "image": "/products/ipads/iPad_Mini_2_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_Mini_2_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_Mini_2_Spacegray.jpg"
              }
            ],
            "storages": [
              "16GB",
              "32GB",
              "64GB",
              "128GB"
            ]
          }
        ]
      },
      {
        "id": "fam-ipad",
        "name": "iPad",
        "models": [
          {
            "id": "mod-ipad11",
            "name": "iPad 11th A16",
            "image": "/products/ipads/iPad_11th_A16_Blue.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_11th_A16_Silver.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_11th_A16_Blue.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/ipads/iPad_11th_A16_Pink.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E642",
                "image": "/products/ipads/iPad_11th_A16_Yellow.jpg"
              }
            ],
            "storages": [
              "128GB",
              "256GB",
              "512GB"
            ]
          },
          {
            "id": "mod-ipad10",
            "name": "iPad 10th Gen",
            "image": "/products/ipads/iPad_10th_Gen_Blue.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_10th_Gen_Silver.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/ipads/iPad_10th_Gen_Blue.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/ipads/iPad_10th_Gen_Pink.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E642",
                "image": "/products/ipads/iPad_10th_Gen_Yellow.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipad9",
            "name": "iPad 9th Gen",
            "image": "/products/ipads/iPad_9th_Gen_Space_Gray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_9th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_9th_Gen_Space_Gray.jpg"
              }
            ],
            "storages": [
              "64GB",
              "256GB"
            ]
          },
          {
            "id": "mod-ipad8",
            "name": "iPad 8th Gen",
            "image": "/products/ipads/iPad_8th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_8th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_8th_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_8th_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB"
            ]
          },
          {
            "id": "mod-ipad7",
            "name": "iPad 7th Gen",
            "image": "/products/ipads/iPad_7th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_7th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_7th_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_7th_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB"
            ]
          },
          {
            "id": "mod-ipad6",
            "name": "iPad 6th Gen",
            "image": "/products/ipads/iPad_6th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_6th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_6th_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_6th_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB"
            ]
          },
          {
            "id": "mod-ipad5",
            "name": "iPad 5th Gen",
            "image": "/products/ipads/iPad_5th_Gen_Spacegray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/ipads/iPad_5th_Gen_Silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/ipads/iPad_5th_Gen_Spacegray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/ipads/iPad_5th_Gen_Gold.jpg"
              }
            ],
            "storages": [
              "32GB",
              "128GB"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "cat-watch",
    "name": "Apple Watch",
    "emoji": "⌚",
    "families": [
      {
        "id": "fam-w11",
        "name": "Series 11",
        "models": [
          {
            "id": "mod-w11-alum",
            "name": "Apple Watch Series 11 Aluminum",
            "image": "/products/watch/series_11_aluminum_jet_black.jpg",
            "colors": [
              {
                "color": "Jet Black",
                "colorHex": "#1C1C1E",
                "image": "/products/watch/series_11_aluminum_jet_black.jpg"
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B4A0",
                "image": "/products/watch/series_11_aluminum_rose_gold.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/watch/series_11_aluminum_space_gray.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/watch/series_11_aluminum_silver.jpg"
              }
            ],
            "storages": [
              "41mm",
              "45mm"
            ]
          },
          {
            "id": "mod-w11-ti",
            "name": "Apple Watch Series 11 Titanium",
            "image": "/products/watch/series_11_titanium_natural.jpg",
            "colors": [
              {
                "color": "Natural",
                "colorHex": "#C5B9A8",
                "image": "/products/watch/series_11_titanium_natural.jpg"
              },
              {
                "color": "Slate",
                "colorHex": "#7A8C8F",
                "image": "/products/watch/series_11_titanium_slate.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/watch/series_11_titanium_gold.jpg"
              }
            ],
            "storages": [
              "45mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w10",
        "name": "Series 10",
        "models": [
          {
            "id": "mod-w10-alum",
            "name": "Apple Watch Series 10 Aluminum",
            "image": "/products/watch/series_10_aluminum_jet_black.jpg",
            "colors": [
              {
                "color": "Jet Black",
                "colorHex": "#1C1C1E",
                "image": "/products/watch/series_10_aluminum_jet_black.jpg"
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B4A0",
                "image": "/products/watch/series_10_aluminum_rose_gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/watch/series_10_aluminum_silver.jpg"
              }
            ],
            "storages": [
              "42mm",
              "46mm"
            ]
          },
          {
            "id": "mod-w10-ti",
            "name": "Apple Watch Series 10 Titanium",
            "image": "/products/watch/series_10_titanium_natural.jpg",
            "colors": [
              {
                "color": "Natural",
                "colorHex": "#C5B9A8",
                "image": "/products/watch/series_10_titanium_natural.jpg"
              },
              {
                "color": "Slate",
                "colorHex": "#7A8C8F",
                "image": "/products/watch/series_10_titanium_slate.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/watch/series_10_titanium_gold.jpg"
              }
            ],
            "storages": [
              "46mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w9",
        "name": "Series 9",
        "models": [
          {
            "id": "mod-w9",
            "name": "Apple Watch Series 9",
            "image": "/products/watch/series_9_aluminum_midnight.jpg",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/watch/series_9_aluminum_midnight.jpg"
              }
            ],
            "storages": [
              "41mm",
              "45mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w8",
        "name": "Series 8",
        "models": [
          {
            "id": "mod-w8",
            "name": "Apple Watch Series 8",
            "image": "/products/watch/series_8_aluminum_midnight.jpg",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/watch/series_8_aluminum_midnight.jpg"
              }
            ],
            "storages": [
              "41mm",
              "45mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w7",
        "name": "Series 7",
        "models": [
          {
            "id": "mod-w7",
            "name": "Apple Watch Series 7",
            "image": "/products/watch/series_7_aluminum_green.jpg",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": null
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": null
              },
              {
                "color": "Green",
                "colorHex": "#5C6F4D",
                "image": "/products/watch/series_7_aluminum_green.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#3B5C8A",
                "image": null
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": null
              }
            ],
            "storages": [
              "41mm",
              "45mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w6",
        "name": "Series 6",
        "models": [
          {
            "id": "mod-w6",
            "name": "Apple Watch Series 6",
            "image": "/products/watch/series_6_aluminum_blue.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": null
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": null
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": null
              },
              {
                "color": "Blue",
                "colorHex": "#3B5C8A",
                "image": "/products/watch/series_6_aluminum_blue.jpg"
              },
              {
                "color": "(PRODUCT)RED",
                "colorHex": "#CC0000",
                "image": null
              }
            ],
            "storages": [
              "40mm",
              "44mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w5",
        "name": "Series 5",
        "models": [
          {
            "id": "mod-w5",
            "name": "Apple Watch Series 5",
            "image": "/products/watch/series_5_aluminum_brush_gold.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": null
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": null
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/watch/series_5_aluminum_brush_gold.jpg"
              }
            ],
            "storages": [
              "40mm",
              "44mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w4",
        "name": "Series 4",
        "models": [
          {
            "id": "mod-w4",
            "name": "Apple Watch Series 4 Stainless",
            "image": "/products/watch/series_4_stainless_gold.jpg",
            "colors": [
              {
                "color": "Gold",
                "colorHex": "#B8975A",
                "image": "/products/watch/series_4_stainless_gold.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": null
              },
              {
                "color": "Black",
                "colorHex": "#1C1C1E",
                "image": null
              }
            ],
            "storages": [
              "40mm",
              "44mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w3",
        "name": "Series 3",
        "models": [
          {
            "id": "mod-w3",
            "name": "Apple Watch Series 3",
            "image": "/products/watch/series_3_aluminum_space_gray.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": null
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/watch/series_3_aluminum_space_gray.jpg"
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": null
              }
            ],
            "storages": [
              "38mm",
              "42mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w2",
        "name": "Series 2",
        "models": [
          {
            "id": "mod-w2",
            "name": "Apple Watch Series 2",
            "image": "/products/watch/series_2_aluminum_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/watch/series_2_aluminum_silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": null
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B5A8",
                "image": null
              }
            ],
            "storages": [
              "38mm",
              "42mm"
            ]
          }
        ]
      },
      {
        "id": "fam-w1",
        "name": "Series 1",
        "models": [
          {
            "id": "mod-w1",
            "name": "Apple Watch Series 1",
            "image": "/products/watch/series_1_aluminum_rose_gold.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": null
              },
              {
                "color": "Rose Gold",
                "colorHex": "#E8B5A8",
                "image": "/products/watch/series_1_aluminum_rose_gold.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": null
              }
            ],
            "storages": [
              "38mm",
              "42mm"
            ]
          }
        ]
      },
      {
        "id": "fam-wu3",
        "name": "Ultra 3",
        "models": [
          {
            "id": "mod-wu3",
            "name": "Apple Watch Ultra 3",
            "image": "/products/watch/ultra_3_titanium_natural.jpg",
            "colors": [
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/watch/ultra_3_titanium_natural.jpg"
              },
              {
                "color": "Black Titanium",
                "colorHex": "#2C2C2C",
                "image": "/products/watch/ultra_3_titanium_black.jpg"
              }
            ],
            "storages": [
              "49mm"
            ]
          }
        ]
      },
      {
        "id": "fam-wu2",
        "name": "Ultra 2",
        "models": [
          {
            "id": "mod-wu2",
            "name": "Apple Watch Ultra 2",
            "image": "/products/watch/ultra_2_titanium_natural.jpg",
            "colors": [
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/watch/ultra_2_titanium_natural.jpg"
              },
              {
                "color": "Black Titanium",
                "colorHex": "#2C2C2C",
                "image": "/products/watch/ultra_2_titanium_black.jpg"
              }
            ],
            "storages": [
              "49mm"
            ]
          }
        ]
      },
      {
        "id": "fam-wu1",
        "name": "Ultra",
        "models": [
          {
            "id": "mod-wu1",
            "name": "Apple Watch Ultra",
            "image": "/products/watch/ultra_titanium_natural.jpg",
            "colors": [
              {
                "color": "Natural Titanium",
                "colorHex": "#C5B9A8",
                "image": "/products/watch/ultra_titanium_natural.jpg"
              }
            ],
            "storages": [
              "49mm"
            ]
          }
        ]
      },
      {
        "id": "fam-wse3",
        "name": "SE (3rd Gen)",
        "models": [
          {
            "id": "mod-wse3",
            "name": "Apple Watch SE (3rd Gen)",
            "image": "/products/watch/se_3_aluminum_midnight.jpg",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/watch/se_3_aluminum_midnight.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/watch/se_3_aluminum_starlight.jpg"
              }
            ],
            "storages": [
              "40mm",
              "44mm"
            ]
          }
        ]
      },
      {
        "id": "fam-wse2",
        "name": "SE (2nd Gen)",
        "models": [
          {
            "id": "mod-wse2",
            "name": "Apple Watch SE (2nd Gen)",
            "image": "/products/watch/se_2_aluminum_midnight.jpg",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/watch/se_2_aluminum_midnight.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/watch/se_2_aluminum_silver.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/watch/se_2_aluminum_starlight.jpg"
              }
            ],
            "storages": [
              "40mm",
              "44mm"
            ]
          }
        ]
      },
      {
        "id": "fam-wse1",
        "name": "SE (1st Gen)",
        "models": [
          {
            "id": "mod-wse1",
            "name": "Apple Watch SE (1st Gen)",
            "image": "/products/watch/se_1st_gen_aluminum_brush_gold.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": null
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": null
              },
              {
                "color": "Gold",
                "colorHex": "#E8C895",
                "image": "/products/watch/se_1st_gen_aluminum_brush_gold.jpg"
              }
            ],
            "storages": [
              "40mm",
              "44mm"
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "cat-airpods",
    "name": "AirPods",
    "emoji": "🎧",
    "families": [
      {
        "id": "fam-appro",
        "name": "AirPods Pro",
        "models": [
          {
            "id": "mod-appro3",
            "name": "AirPods Pro 3",
            "image": "/products/airpods/AirPods_Pro_3_White.png",
            "colors": [
              {
                "color": "White",
                "colorHex": "#FAFAFA",
                "image": "/products/airpods/AirPods_Pro_3_White.png"
              }
            ],
            "storages": []
          },
          {
            "id": "mod-appro2",
            "name": "AirPods Pro 2",
            "image": "/products/airpods/AirPods_Pro_2_White.png",
            "colors": [
              {
                "color": "White",
                "colorHex": "#FAFAFA",
                "image": "/products/airpods/AirPods_Pro_2_White.png"
              }
            ],
            "storages": [
              "USB-C",
              "Lightning"
            ]
          }
        ]
      },
      {
        "id": "fam-apmax",
        "name": "AirPods Max",
        "models": [
          {
            "id": "mod-apmax2",
            "name": "AirPods Max 2",
            "image": "/products/airpods/AirPods_Max_2_Midnight.png",
            "colors": [
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/airpods/AirPods_Max_2_Midnight.png"
              },
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/airpods/AirPods_Max_2_Blue.png"
              },
              {
                "color": "Orange",
                "colorHex": "#D4621A",
                "image": "/products/airpods/AirPods_Max_2_Orange.png"
              },
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/airpods/AirPods_Max_2_Purple.png"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/airpods/AirPods_Max_2_Starlight.png"
              }
            ],
            "storages": []
          }
        ]
      },
      {
        "id": "fam-ap",
        "name": "AirPods",
        "models": [
          {
            "id": "mod-ap4",
            "name": "AirPods 4",
            "image": "/products/airpods/AirPods_4_White.png",
            "colors": [
              {
                "color": "White",
                "colorHex": "#FAFAFA",
                "image": "/products/airpods/AirPods_4_White.png"
              }
            ],
            "storages": []
          },
          {
            "id": "mod-ap3",
            "name": "AirPods (3rd Gen)",
            "image": "/products/airpods/AirPods_3rd_Gen_White_MagSafe_Case.png",
            "colors": [
              {
                "color": "White",
                "colorHex": "#FAFAFA",
                "image": "/products/airpods/AirPods_3rd_Gen_White_MagSafe_Case.png"
              }
            ],
            "storages": [
              "MagSafe",
              "Lightning"
            ]
          },
          {
            "id": "mod-ap2",
            "name": "AirPods (2nd Gen)",
            "image": "/products/airpods/AirPods_2nd_Gen_White.png",
            "colors": [
              {
                "color": "White",
                "colorHex": "#FAFAFA",
                "image": "/products/airpods/AirPods_2nd_Gen_White.png"
              }
            ],
            "storages": []
          }
        ]
      }
    ]
  },
  {
    "id": "cat-mac",
    "name": "Mac",
    "emoji": "💻",
    "families": [
      {
        "id": "fam-mba",
        "name": "MacBook Air",
        "models": [
          {
            "id": "mod-mba13m5",
            "name": "MacBook Air 13\" M5",
            "image": "/products/mac/compare_macbook_air_m5_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_air_m5_silver.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/mac/compare_macbook_air_m5_midnight.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/mac/compare_macbook_air_m5_starlight.jpg"
              },
              {
                "color": "Sky Blue",
                "colorHex": "#8BBCD4",
                "image": "/products/mac/compare_macbook_air_m5_skyblue.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "16GB/512GB",
              "24GB/512GB",
              "24GB/1TB"
            ]
          },
          {
            "id": "mod-mba15m5",
            "name": "MacBook Air 15\" M5",
            "image": "/products/mac/compare_macbook_air_m5_15_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_air_m5_15_silver.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/mac/compare_macbook_air_m5_15_midnight.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/mac/compare_macbook_air_m5_15_starlight.jpg"
              },
              {
                "color": "Sky Blue",
                "colorHex": "#8BBCD4",
                "image": "/products/mac/compare_macbook_air_m5_15_skyblue.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "16GB/512GB",
              "24GB/512GB",
              "24GB/1TB"
            ]
          },
          {
            "id": "mod-mba13m4",
            "name": "MacBook Air 13\" M4",
            "image": "/products/mac/compare_macbook_air_mx_skyblue.jpg",
            "colors": [
              {
                "color": "Sky Blue",
                "colorHex": "#8BBCD4",
                "image": "/products/mac/compare_macbook_air_mx_skyblue.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/mac/compare_macbook_air_mx_midnight.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_air_mx_silver.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/mac/compare_macbook_air_mx_starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/mac/compare_macbook_air_mx_spacegray.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "16GB/512GB",
              "24GB/512GB"
            ]
          },
          {
            "id": "mod-mba15m4",
            "name": "MacBook Air 15\" M4",
            "image": "/products/mac/compare_macbook_air_mx_15_silver.jpg",
            "colors": [
              {
                "color": "Sky Blue",
                "colorHex": "#8BBCD4",
                "image": "/products/mac/compare_macbook_air_mx_15_skyblue.jpg"
              },
              {
                "color": "Midnight",
                "colorHex": "#1C1C1E",
                "image": "/products/mac/compare_macbook_air_mx_15_midnight.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_air_mx_15_silver.jpg"
              },
              {
                "color": "Starlight",
                "colorHex": "#F5F0E8",
                "image": "/products/mac/compare_macbook_air_mx_15_starlight.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/mac/compare_macbook_air_mx_15_spacegray.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "16GB/512GB"
            ]
          }
        ]
      },
      {
        "id": "fam-mbp",
        "name": "MacBook Pro",
        "models": [
          {
            "id": "mod-mbp14m5",
            "name": "MacBook Pro 14\" M5",
            "image": "/products/mac/compare_macbook_pro_m5_14_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_pro_m5_14_silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C2E",
                "image": "/products/mac/compare_macbook_pro_m5_14_spaceblack.jpg"
              }
            ],
            "storages": [
              "24GB/512GB",
              "24GB/1TB",
              "36GB/1TB"
            ]
          },
          {
            "id": "mod-mbp16m5",
            "name": "MacBook Pro 16\" M5",
            "image": "/products/mac/compare_macbook_pro_m5_16_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_pro_m5_16_silver.jpg"
              },
              {
                "color": "Space Black",
                "colorHex": "#1C1C2E",
                "image": "/products/mac/compare_macbook_pro_m5_16_spaceblack.jpg"
              }
            ],
            "storages": [
              "24GB/512GB",
              "48GB/1TB",
              "48GB/2TB"
            ]
          },
          {
            "id": "mod-mbp14m4",
            "name": "MacBook Pro 14\" M3/M4",
            "image": "/products/mac/compare_macbook_pro_14_spaceblack.jpg",
            "colors": [
              {
                "color": "Space Black",
                "colorHex": "#1C1C2E",
                "image": "/products/mac/compare_macbook_pro_14_spaceblack.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_pro_14_silver.jpg"
              },
              {
                "color": "Space Gray",
                "colorHex": "#57534E",
                "image": "/products/mac/compare_macbook_pro_14_spacegray.jpg"
              }
            ],
            "storages": [
              "18GB/512GB",
              "36GB/512GB",
              "36GB/1TB"
            ]
          },
          {
            "id": "mod-mbp16m4",
            "name": "MacBook Pro 16\" M3/M4",
            "image": "/products/mac/compare_macbook_pro_16_spaceblack.jpg",
            "colors": [
              {
                "color": "Space Black",
                "colorHex": "#1C1C2E",
                "image": "/products/mac/compare_macbook_pro_16_spaceblack.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_pro_16_silver.jpg"
              }
            ],
            "storages": [
              "24GB/512GB",
              "36GB/1TB",
              "48GB/1TB"
            ]
          }
        ]
      },
      {
        "id": "fam-imac",
        "name": "iMac",
        "models": [
          {
            "id": "mod-imac24m4",
            "name": "iMac 24\" M4",
            "image": "/products/mac/compare_imac_24_m4_silver.jpg",
            "colors": [
              {
                "color": "Purple",
                "colorHex": "#9B7FB6",
                "image": "/products/mac/compare_imac_24_m4_purple.jpg"
              },
              {
                "color": "Green",
                "colorHex": "#4A7B5C",
                "image": "/products/mac/compare_imac_24_m4_green.jpg"
              },
              {
                "color": "Yellow",
                "colorHex": "#F5E642",
                "image": "/products/mac/compare_imac_24_m4_yellow.jpg"
              },
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_imac_24_m4_silver.jpg"
              },
              {
                "color": "Pink",
                "colorHex": "#F2A7B0",
                "image": "/products/mac/compare_imac_24_m4_pink.jpg"
              },
              {
                "color": "Blue",
                "colorHex": "#4A7BA8",
                "image": "/products/mac/compare_imac_24_m4_blue.jpg"
              },
              {
                "color": "Orange",
                "colorHex": "#D4621A",
                "image": "/products/mac/compare_imac_24_m4_orange.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "24GB/512GB"
            ]
          }
        ]
      },
      {
        "id": "fam-macmini",
        "name": "Mac mini",
        "models": [
          {
            "id": "mod-macminim4",
            "name": "Mac mini M4",
            "image": "/products/mac/compare_mac_mini_m4_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_mac_mini_m4_silver.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "24GB/256GB",
              "16GB/512GB"
            ]
          }
        ]
      },
      {
        "id": "fam-macstudio",
        "name": "Mac Studio",
        "models": [
          {
            "id": "mod-macstudio",
            "name": "Mac Studio",
            "image": "/products/mac/compare_mac_studio_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_mac_studio_silver.jpg"
              }
            ],
            "storages": [
              "36GB/512GB",
              "64GB/1TB"
            ]
          }
        ]
      },
      {
        "id": "fam-mbkneo",
        "name": "MacBook Neo",
        "models": [
          {
            "id": "mod-mbkneo",
            "name": "MacBook Neo A18 Pro",
            "image": "/products/mac/compare_macbook_neo_a18_silver.jpg",
            "colors": [
              {
                "color": "Silver",
                "colorHex": "#E8E3DC",
                "image": "/products/mac/compare_macbook_neo_a18_silver.jpg"
              },
              {
                "color": "Blush",
                "colorHex": "#E8C4B8",
                "image": "/products/mac/compare_macbook_neo_a18_blush.jpg"
              },
              {
                "color": "Citrus",
                "colorHex": "#D4A830",
                "image": "/products/mac/compare_macbook_neo_a18_citrus.jpg"
              },
              {
                "color": "Indigo",
                "colorHex": "#3B4B9E",
                "image": "/products/mac/compare_macbook_neo_a18_indigo.jpg"
              }
            ],
            "storages": [
              "16GB/256GB",
              "32GB/512GB"
            ]
          }
        ]
      }
    ]
  }
];
