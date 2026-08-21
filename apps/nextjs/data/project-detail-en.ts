import type { LandingFAQ, LandingStat, LandingEntityRow } from "./landing-projects";

export interface ProjectDetailEnglishCopy {
  eyebrow: string;
  desc: string;
  heroImageAlt: string;
  heroSub: string;
  heroMeta: string;
  overviewParas: string[];
  entityTable: LandingEntityRow[];
  locationIntro: string;
  faq: LandingFAQ[];
  navLinks: { href: string; label: string }[];
  stats: LandingStat[];
}

export const PROJECT_DETAIL_EN: Record<string, ProjectDetailEnglishCopy> = {
  "aqua-city": {
    "desc": "Reference information regarding Aqua City Novaland in Dong Nai: location, products, sub-zones, pricing, legal status, and progress. Transaction data must be verified for each specific product using current documentation.",
    "entityTable": [
      {
        "k": "Project Name",
        "v": "Aqua City (Aqua City Ecological Urban Area)"
      },
      {
        "k": "Developer",
        "v": "Novaland Group (Stock Code: NVL – HOSE)"
      },
      {
        "k": "Location",
        "v": "Long Hung Commune, Bien Hoa City, Dong Nai Province"
      },
      {
        "k": "GPS Coordinates",
        "v": "10.9282°N, 106.7992°E"
      },
      {
        "k": "Scale",
        "v": "1,000 ha (reference)"
      },
      {
        "k": "Number of Sub-zones",
        "v": "Requires verification against current project documentation"
      },
      {
        "k": "Total Products",
        "v": "Requires verification against current project documentation"
      },
      {
        "k": "Greenery & Water Surface",
        "v": "Requires verification against published planning"
      },
      {
        "k": "Connection Infrastructure",
        "v": "Verify with maps, routes, and actual progress"
      },
      {
        "k": "Townhouse",
        "v": "From 6 billion (reference price)"
      },
      {
        "k": "Villa",
        "v": "From 8.5 billion (reference price)"
      },
      {
        "k": "Shophouse",
        "v": "From 10 billion (reference price)"
      },
      {
        "k": "Distribution Status",
        "v": "Written confirmation required before transaction"
      }
    ],
    "eyebrow": "Novaland Group • Dong Nai • Reference Information",
    "faq": [
      {
        "a": "Aqua City Novaland is introduced as an urban area in Long Hung, Bien Hoa, Dong Nai, developed by Novaland. Scale, number of sub-zones, number of products, and greenery ratios must be cross-referenced with planning documents or official materials with update dates.",
        "q": "What is the Aqua City project?"
      },
      {
        "a": "Aqua City is introduced in Long Hung, Bien Hoa, Dong Nai. Distances to HCMC, the airport, or interchanges must be measured according to specific sub-zones, routes, and timing; promotional distances should not replace maps and actual data.",
        "q": "Where is Aqua City? What is the specific address?"
      },
      {
        "a": "The page currently lists Novaland as the developer/legal entity developing Aqua City. Buyers should verify the legal entity name in decisions, contracts, and current project documentation; descriptions of group scale or project counts are not to be considered legal evidence of the product.",
        "q": "Who is the developer of Aqua City?"
      },
      {
        "a": "Aqua City has many sub-zone names and product types mentioned in market documents. The list, scale, handover status, and amenities of each sub-zone should be checked using current documentation before being used for comparison or transactions.",
        "q": "How many sub-zones and products does Aqua City have?"
      },
      {
        "a": "The status of certificates for Aqua City may vary by sub-zone and product. Buyers need to check the original documentation, planning, mortgages, financial obligations, certificate issuance conditions, and written confirmation before transacting.",
        "q": "What is the legal status of Aqua City in 2026 — has the red book been issued yet?"
      },
      {
        "a": "Aqua City reference price list: townhouses from 6 billion, villas from 8.5 billion, and shophouses from 10 billion. These are starting reference prices provided by SGS Land, subject to change based on sub-zone, area, legal status, payment conditions, and timing; confirm the price list for the specific product before deciding.",
        "q": "What is the selling price of Aqua City in 2026?"
      },
      {
        "a": "The resident status and operational level may vary by sub-zone. Buyers should conduct field surveys, check handover rates, and ask resident sources or the management board for verification rather than inferring for the entire project.",
        "q": "Are there residents living in Aqua City yet?"
      },
      {
        "a": "Travel time from Aqua City to HCMC depends on the starting point, sub-zone, route, traffic conditions, and time of day. Please check maps and actual travel times; planned infrastructure is not a commitment regarding time.",
        "q": "How long does it take to travel from Aqua City to HCMC?"
      },
      {
        "a": "Amenities must be categorized by those in operation, under construction, and newly planned. Buyers should check the list, operator, opening time, and accessibility of the specific sub-zone instead of relying solely on promotional lists.",
        "q": "What are the notable amenities at Aqua City?"
      },
      {
        "a": "Long Thanh Airport may affect regional connectivity, but the operational timing, actual distance, and impact on pricing must be verified from regulatory agency sources and transaction data. Specific price increases cannot be inferred solely from the project's proximity to the airport.",
        "q": "Does Long Thanh Airport affect Aqua City?"
      },
      {
        "a": "There is no universal buying recommendation. Before considering Aqua City, verify the legal status of the specific product, dated transaction prices, progress, liquidity, loan costs, and contract terms; do not rely on price increase forecasts or unverified adjustment ratios.",
        "q": "Should one buy Aqua City for investment? What are the risks?"
      },
      {
        "a": "SGS Land provides contact channels for users to request information about Aqua City. Distribution status, price lists, legal status, and policies must be confirmed with current documentation; buyers should not consider consultation content as a transaction guarantee or a substitute for independent due diligence.",
        "q": "How to contact for Aqua City consultation via SGS Land?"
      }
    ],
    "heroImageAlt": "Panorama of Aqua City Novaland in Dong Nai — location and urban area information",
    "heroMeta": "Developer recorded: Novaland | Price, legal status, and progress require verification",
    "heroSub": "Aqua City Novaland — Bien Hoa, Dong Nai",
    "locationIntro": "Aqua City is introduced in Long Hung, Bien Hoa, Dong Nai. Distances, travel times, project boundaries, and landscape features must be verified using maps and current documentation; the page does not consider promotional information as independent evidence.",
    "navLinks": [
      {
        "href": "#tong-quan",
        "label": "Overview"
      },
      {
        "href": "#vi-tri",
        "label": "Location"
      },
      {
        "href": "#tien-ich",
        "label": "Amenities"
      },
      {
        "href": "#bang-gia",
        "label": "Price List"
      },
      {
        "href": "#faq",
        "label": "FAQ"
      },
      {
        "href": "#lien-he",
        "label": "Contact"
      }
    ],
    "overviewParas": [
      "Aqua City Novaland is introduced as an urban area in Long Hung, Bien Hoa, Dong Nai, developed by Novaland. This page provides reference information for buyers to begin assessing the entity, location, products, and project documentation.",
      "Figures regarding scale, number of sub-zones, total products, amenities, and investment capital may vary depending on documents and the time of announcement. Only use figures that have clear sources, verification dates, and explicit scopes of application.",
      "Connectivity, distance, and travel time should be measured according to specific sub-zones, routes, and timing. Planned infrastructure is not a guarantee of price, liquidity, or profit."
    ],
    "stats": [
      {
        "lbl": "Reference Scale",
        "num": "1,000 ha"
      },
      {
        "lbl": "Number of sub-zones",
        "num": "Need verification"
      },
      {
        "lbl": "Total products",
        "num": "By product"
      },
      {
        "lbl": "Distance to HCMC",
        "num": "By route"
      },
      {
        "lbl": "Greenery & water",
        "num": "By record"
      },
      {
        "lbl": "Natural landscape",
        "num": "By record"
      }
    ]
  },
  "the-global-city": {
    "desc": "The Global City is a 117.4ha mixed-use urban area by Masterise Homes in Binh Trung Ward, Thu Duc City, approximately 7-9km from the District 1 center. Updated pricing, legal status, and 2026 progress.",
    "entityTable": [
      {
        "k": "Project name",
        "v": "The Global City"
      },
      {
        "k": "Developer",
        "v": "Masterise Homes (member of Masterise Group)"
      },
      {
        "k": "Location",
        "v": "Do Xuan Hop – Song Hanh – Lien Phuong Road, Binh Trung Ward, Thu Duc City, HCMC (formerly An Phu area, former District 2)"
      },
      {
        "k": "GPS Coordinates",
        "v": "10.7945° N, 106.7478° E (project center area, reference)"
      },
      {
        "k": "Scale",
        "v": "117.4ha (approximately 1,174,220 m²)"
      },
      {
        "k": "Number of subdivisions/products",
        "v": "5 functional subdivisions: SOHO, City Park, high-rise apartment area, villas/mansions (Villa SOLA), commercial-service area"
      },
      {
        "k": "Total products",
        "v": "According to some aggregated sources: approximately 10,000 apartments and over 1,000 low-rise products (villas, townhouses, shophouses) – reference data, no official unified announcement yet"
      },
      {
        "k": "Connectivity infrastructure",
        "v": "An Phu intersection (~1km away), HCMC – Long Thanh – Dau Giay Expressway, Hanoi Highway, Thu Thiem Tunnel, near Rach Chiec station – Metro Line 1 Ben Thanh – Suoi Tien (operational since end of 2024)"
      },
      {
        "k": "Total investment",
        "v": "Not officially announced by the developer"
      },
      {
        "k": "Consulting channel",
        "v": "0971 132 378 (SGS LAND – provides reference information)"
      }
    ],
    "eyebrow": "New central mega-urban area",
    "faq": [
      {
        "a": "The Global City is a 117.4ha mixed-use urban area developed by Masterise Homes, located on the Do Xuan Hop – Song Hanh – Lien Phuong axis, currently in Binh Trung Ward, Thu Duc City, HCMC (area of former An Phu, District 2 before the merger on July 1, 2025). The project broke ground in March 2021 with architectural planning carried out by Foster + Partners.",
        "q": "What is The Global City project and where is it located?"
      },
      {
        "a": "The project has a total area of 117.4ha, divided into approximately 5 functional subdivisions including the SOHO low-rise area, City Park central park (~13ha), luxury villas/mansions, and high-rise apartment clusters such as Masteri Grand View, Lumiere Midtown, Masteri Park Place, and Masteri Cosmo Central. According to some aggregated sources, the total number of products for the entire project is about 10,000 apartments and over 1,000 low-rise products, however, this number may change according to each sales phase.",
        "q": "What is the scale of The Global City and how many subdivisions does it have?"
      },
      {
        "a": "The SOHO low-rise area of The Global City has been handed over and pink books have been issued for the completed products. Vietnamese citizens own them permanently, while foreigners own them for a maximum of 50 years according to current laws (2023 Housing Law, 2024 Land Law, 2023 Real Estate Business Law). The high-rise apartment subdivisions under construction will be issued books according to the actual handover progress of each batch.",
        "q": "What is the current legal status of The Global City, and has the pink book been issued?"
      },
      {
        "a": "The reference primary apartment price according to the developer/agency price list is updated at approximately 110-142 million VND/m² (2026), depending on location and subdivision. On the secondary market, reference prices by type are: 1-bedroom apartment approx. 6.19-7.4 billion VND, 2-bedroom approx. 7.89-9.89 billion VND, 3-bedroom approx. 11.14-17.38 billion VND; some records show that secondary prices have adjusted downward compared to 1 year ago. This is a reference price aggregated from the market, not an official list price; customers should contact SGS Land for quotes updated by period.",
        "q": "What is the current selling price of The Global City?"
      },
      {
        "a": "As of early 2026, the project has completed approximately 70% of the overall volume: the SOHO area has been handed over and is in operation (approx. 80% of commercial premises are in business), and the City Park has been operating since March 2024. The Masteri Grand View apartment tower is being finished, expected to be handed over at the end of 2026; the remaining towers (Lumiere Midtown, Masteri Park Place, Masteri Cosmo Central) are in the structural construction phase, expected to be handed over in subsequent years.",
        "q": "What is the handover progress and current occupancy status of The Global City?"
      },
      {
        "a": "The Global City is about 7-9km from the District 1 center, traveling via the Mai Chi Tho axis and Thu Thiem Tunnel takes about 15-20 minutes by car/motorbike depending on the time. The project is also located near the An Phu intersection, HCMC – Long Thanh – Dau Giay Expressway, and Rach Chiec station of Metro Line 1 (Ben Thanh – Suoi Tien).",
        "q": "How far is The Global City from the HCMC center (District 1)?"
      },
      {
        "a": "SGS Land is a real estate consulting unit with experience in updating selling prices, sales policies, and actual legal status at The Global City periodically, helping customers compare information from the developer and the secondary market before deciding to transact. Contact hotline 0971 132 378 for detailed advice and the latest updated price list.",
        "q": "Why should you learn about The Global City through SGS Land?"
      }
    ],
    "heroImageAlt": "Overview perspective of The Global City Masterise Homes urban area in Binh Trung Ward, Thu Duc City",
    "heroMeta": "Developer: Masterise Homes | 117.4ha | Binh Trung Ward, Thu Duc City (formerly An Phu area)",
    "heroSub": "A 117.4ha project on the Do Xuan Hop – Song Hanh – Lien Phuong axis, Binh Trung Ward, Thu Duc City, developed by Masterise Homes and master-planned by Foster + Partners.",
    "locationIntro": "The Global City is located on the Do Xuan Hop – Song Hanh – Lien Phuong axis, currently in Binh Trung Ward, Thu Duc City (area of former An Phu, District 2 before the administrative merger on July 1, 2025), adjacent to the Rach Chiec River, near Sala urban area, Saigon Sports City, and Thao Dien. From the project, it takes approximately 7-9km to reach the District 1 center via Mai Chi Tho and the Thu Thiem Tunnel, while also providing convenient access to the HCMC – Long Thanh – Dau Giay Expressway, Hanoi Highway, and Rach Chiec station of Metro Line 1 (Ben Thanh – Suoi Tien).",
    "navLinks": [
      {
        "href": "#tong-quan",
        "label": "Overview"
      },
      {
        "href": "#vi-tri",
        "label": "Location"
      },
      {
        "href": "#tien-ich",
        "label": "Utilities"
      },
      {
        "href": "#bang-gia",
        "label": "Price List"
      },
      {
        "href": "#faq",
        "label": "FAQ"
      },
      {
        "href": "#lien-he",
        "label": "Contact"
      }
    ],
    "overviewParas": [
      "The Global City is a 117.4ha mixed-use urban area developed by Masterise Homes, located on the Do Xuan Hop – Song Hanh – Lien Phuong axis, now in Binh Trung Ward, Thu Duc City, Ho Chi Minh City (prior to the administrative merger on July 1, 2025, this area was part of An Phu Ward, former District 2). The project broke ground in March 2021, with architectural planning by Foster + Partners (UK) and landscape consulting by WATG.",
      "According to the plan, The Global City consists of approximately 5 main functional subdivisions: the SOHO low-rise area (shophouses, already handed over and issued pink books), the City Park central park (approx. 13ha, operational since March 2024), luxury villas/mansions (Villa SOLA), along with high-rise apartment clusters currently under development such as Masteri Grand View, Lumiere Midtown, Masteri Park Place, and Masteri Cosmo Central. Based on aggregated sources, the project scale is approximately 10,000 apartments and over 1,000 low-rise products (villas, townhouses, shophouses); the construction density is approximately 28%.",
      "As of early 2026, the project has completed approximately 70% of the overall volume according to distribution partners: the entire SOHO area (over 400 shophouses) has been handed over and issued pink books, the Masteri Grand View tower is in the finishing stage for handover at the end of 2026, and the Lumiere Midtown, Masteri Park Place, and Masteri Cosmo Central towers are in the structural/foundation construction phase. Internal infrastructure (approximately 30 roads, underground electricity, water supply/drainage, and landscaping) has been basically completed."
    ],
    "stats": [
      {
        "lbl": "Total area",
        "num": "117,4ha"
      },
      {
        "lbl": "Apartments & low-rise (reference)",
        "num": "~10.000+"
      },
      {
        "lbl": "Functional subdivisions",
        "num": "5"
      },
      {
        "lbl": "Completion volume (early 2026)",
        "num": "70%"
      },
      {
        "lbl": "To District 1 center",
        "num": "7-9km"
      },
      {
        "lbl": "Primary apartment price (reference)",
        "num": "110-142tr/m²"
      }
    ]
  },
  "izumi-city": {
    "desc": "Izumi City Bien Hoa: 170ha urban area by Nam Long & Hankyu Hanshin (Japan), 9 zones, ~13,500 products, long-term pink book ownership, 20 minutes from HCMC. Sales prices, legal status 2026.",
    "entityTable": [
      {
        "k": "Project Name",
        "v": "Izumi City (Izumi City Urban Area / Waterfront City)"
      },
      {
        "k": "Investor",
        "v": "Nam Long Group, in joint venture with Hankyu Hanshin Properties Corp (Japan) via Waterfront City Dong Nai LLC"
      },
      {
        "k": "Location",
        "v": "Huong Lo 2 – Nam Cao Intersection, Long Hung Ward, Bien Hoa City, Dong Nai Province"
      },
      {
        "k": "GPS Coordinates",
        "v": "10.9264° N, 106.8931° E (reference, Long Hung Ward area)"
      },
      {
        "k": "Scale",
        "v": "170 ha (21ha green space, 9ha commercial, 7ha educational, 6ha water surface, 5.5km Dong Nai riverfront)"
      },
      {
        "k": "Number of Zones / Products",
        "v": "9 zones, approximately 13,500 products (townhouses, shophouses, semi-detached/detached villas, riverside villas)"
      },
      {
        "k": "Total Products",
        "v": "~13,500 units, planned population of about 25,000"
      },
      {
        "k": "Connectivity Infrastructure",
        "v": "HCMC – Long Thanh – Dau Giay Expressway, National Highway 51, Ring Road 3, ~20 mins to Long Thanh Airport and HCMC center (developer announcement)"
      },
      {
        "k": "Total Investment",
        "v": "Approximately 18.6 trillion VND (2021 Nam Long – Hankyu Hanshin partnership announcement)"
      },
      {
        "k": "Consulting Channel",
        "v": "0971 132 378 (SGS LAND – provides reference information)"
      }
    ],
    "eyebrow": "Japanese-standard riverside urban area – Nam Long Group",
    "faq": [
      {
        "a": "Izumi City is a 170ha complex riverside urban area in Long Hung Ward, Bien Hoa, Dong Nai, developed by Nam Long Group in joint venture with Hankyu Hanshin Properties Corp (Japan). The project includes townhouses, shophouses, villas, and internal amenities integrated with education, commerce, health, and riverside green spaces.",
        "q": "What is Izumi City?"
      },
      {
        "a": "Izumi City is master-planned into 9 zones with approximately 13,500 products across a total area of 170ha, including 21ha of green space, 9ha of commercial area, 7ha for education, 6ha of water surface, and 5.5km of Dong Nai river frontage, serving an expected population of 25,000.",
        "q": "What is the scale of Izumi City and how many zones does it have?"
      },
      {
        "a": "According to the developer and distributors, low-rise residential products in phases that have completed infrastructure at Izumi City are granted individual long-term pink books/red books. However, legal status may vary by zone and phase, so customers should request to check the specific legal file for each house/lot before transacting.",
        "q": "What is the current legal status of Izumi City, are pink books available?"
      },
      {
        "a": "Reference prices (varying by source, time, and lot location) are approximately 6.4–9 billion VND/unit for townhouses, 12–14.3 billion VND for semi-detached villas, from 16 billion VND for detached villas, and 20 billion to over 45 billion VND for riverside villas in the Izumi Riverside/Canaria zone, depending on location. These are reference prices synthesized from the market and not an official price list from the developer – please contact SGS Land for updated quotes and sales policies for each launch phase.",
        "q": "What is the current selling price (2026) for Izumi City?"
      },
      {
        "a": "Yes, phases 1A1 and 1A2 of Izumi City have handed over houses since October 2023 and residents are currently living there. Newer zones like Izumi Canaria (part of Izumi Riverside) are in the open-sale, reservation, and construction phase for 2025–2026.",
        "q": "Has Izumi City handed over houses and are there residents living there?"
      },
      {
        "a": "According to the developer, Izumi City is about 20 minutes from HCMC center and Long Thanh International Airport thanks to direct connectivity with the HCMC – Long Thanh – Dau Giay Expressway and National Highway 51; actual travel time may change depending on traffic conditions and local infrastructure completion progress.",
        "q": "How far is Izumi City from HCMC center and Long Thanh airport?"
      },
      {
        "a": "The primary investor is Nam Long Group, cooperating with Hankyu Hanshin Properties Corp from Japan through the project entity Waterfront City Dong Nai LLC, with a capital contribution ratio of 65.1% for Nam Long and 34.9% for Hankyu Hanshin as announced in 2021.",
        "q": "Who is the investor of Izumi City?"
      }
    ],
    "heroImageAlt": "Perspective of Izumi City riverside urban area on the Dong Nai River, Long Hung Ward, Bien Hoa City",
    "heroMeta": "170ha · 9 zones · ~13,500 products · Long Hung Ward, Bien Hoa City, Dong Nai",
    "heroSub": "Updated sales prices, zone master plans, legal status (pink book), and latest handover progress 2026 from SGS LAND; information must be verified against current products and documents.",
    "locationIntro": "Izumi City is located in Long Hung Ward, Bien Hoa City, Dong Nai Province – a riverside area on the Dong Nai River adjacent to major arterial roads such as the HCMC – Long Thanh – Dau Giay Expressway, National Highway 51, and Ring Road 3, creating advantages for quick connection to HCMC center, Nhon Trach, and the under-construction Long Thanh International Airport. The riverside location also allows residents to travel by waterway via speed boat to the Bach Dang area, District 1.",
    "navLinks": [
      {
        "href": "#tong-quan",
        "label": "Overview"
      },
      {
        "href": "#vi-tri",
        "label": "Location"
      },
      {
        "href": "#tien-ich",
        "label": "Amenities"
      },
      {
        "href": "#bang-gia",
        "label": "Price List"
      },
      {
        "href": "#faq",
        "label": "FAQ"
      },
      {
        "href": "#lien-he",
        "label": "Contact"
      }
    ],
    "overviewParas": [
      "Izumi City is a 170ha complex urban area with Nam Long Group as the primary investor, in joint venture with Hankyu Hanshin Properties Corp (Japan) through Waterfront City Dong Nai LLC (Nam Long 65.1%, Hankyu Hanshin 34.9%), located at the intersection of Huong Lo 2 and Nam Cao streets, Long Hung Ward, Bien Hoa City, Dong Nai Province. The project was announced in 2021 with a total investment of approximately 18.6 trillion VND and construction began shortly after.",
      "According to the master plan, Izumi City is divided into 9 zones with approximately 13,500 products including townhouses, shophouses, semi-detached villas, detached villas, and premium riverside villa lines (Izumi Riverside, Izumi Canaria), serving an expected population of 25,000. The project allocates approximately 21ha for green space, 9ha for commercial use, 7ha for education, 6ha for water surfaces, and features 5.5km of Dong Nai River frontage, along with a 2.3km commercial-service axis running through the project.",
      "Regarding legal status, low-rise residential products in phases with completed infrastructure have been announced to receive long-term ownership certificates (pink books/red books) per individual lot. Phases 1A1 and 1A2 have been handed over since October 2023 and are currently occupied, while the Izumi Canaria zone (part of Izumi Riverside) is currently in the open-sale stage, accepting reservations for 2025–2026. The project connects directly to the HCMC – Long Thanh – Dau Giay Expressway, National Highway 51, and Ring Road 3, and according to the developer, is only 20 minutes from both HCMC center and Long Thanh International Airport."
    ],
    "stats": [
      {
        "lbl": "Total project scale",
        "num": "170 ha"
      },
      {
        "lbl": "Planned zones",
        "num": "9"
      },
      {
        "lbl": "Total project products",
        "num": "~13,500"
      },
      {
        "lbl": "Dong Nai riverfront",
        "num": "5.5 km"
      },
      {
        "lbl": "Planned population (people)",
        "num": "~25,000"
      },
      {
        "lbl": "To HCMC / Long Thanh airport (per developer)",
        "num": "~20 minutes"
      }
    ]
  },
  "vinhomes-grand-park": {
    "desc": "Vinhomes Grand Park is a 271-hectare mega-city developed by Vingroup in Thu Duc City, featuring a scale of 44,000 units, long-term pink books, and a 36-hectare central park. Updated prices and legal status for 2026.",
    "entityTable": [
      {
        "k": "Project Name",
        "v": "Vinhomes Grand Park"
      },
      {
        "k": "Developer",
        "v": "Vingroup (Vinhomes brand)"
      },
      {
        "k": "Location",
        "v": "Nguyen Xien Street, Tang Nhon Phu and Long Binh Wards, Ho Chi Minh City (formerly District 9, Thu Duc City)"
      },
      {
        "k": "GPS Coordinates",
        "v": "10.8419° N, 106.8347° E (reference)"
      },
      {
        "k": "Scale",
        "v": "271ha, construction density ~25%, 36ha central park"
      },
      {
        "k": "Number of Sub-divisions",
        "v": "8 sub-divisions: The Beverly, Glory Heights, The Beverly Solari, The Opus One, The Origami, The Rainbow, The Manhattan, The Manhattan Glory"
      },
      {
        "k": "Total Products",
        "v": "~44,000 apartments and low-rise products, 71 towers of 25-30 floors"
      },
      {
        "k": "Legal Status",
        "v": "Long-term ownership pink book (for handed-over sub-divisions); foreigners entitled to maximum 50 years"
      },
      {
        "k": "Infrastructure Connectivity",
        "v": "Near Ring Road 3, Metro Line 1 (Ben Thanh - Suoi Tien); ~25 minutes to Thu Thiem center, ~55 minutes to Tan Son Nhat Airport"
      },
      {
        "k": "Consultation Channel",
        "v": "0971 132 378 (SGS LAND – providing reference information)"
      }
    ],
    "eyebrow": "The largest park-themed mega-city in Ho Chi Minh City",
    "faq": [
      {
        "a": "Vinhomes Grand Park is a 271-hectare mega-city developed by Vingroup on Nguyen Xien Street, currently in Tang Nhon Phu and Long Binh Wards, Ho Chi Minh City (formerly District 9). It is one of the urban areas with the largest park scale in HCMC, featuring a 36-hectare central park, breaking ground in 2017.",
        "q": "What is Vinhomes Grand Park, and where is it located?"
      },
      {
        "a": "The project includes 8 sub-divisions: The Beverly, Glory Heights, The Beverly Solari, The Opus One, The Origami, The Rainbow, The Manhattan, and The Manhattan Glory, with 71 apartment towers of 25-30 floors. Total project scale as announced is approximately 44,000 apartments and low-rise products.",
        "q": "How many sub-divisions and apartments does Vinhomes Grand Park have?"
      },
      {
        "a": "Yes. Handed-over sub-divisions of Vinhomes Grand Park have been issued long-term ownership pink books for domestic buyers; foreigners are permitted a maximum of 50 years according to current legal regulations. The Rainbow sub-division was handed over earliest in June 2020 and has had stable occupancy for many years.",
        "q": "Does Vinhomes Grand Park have pink books?"
      },
      {
        "a": "Current market reference prices range from 45-60 million VND/m² for the mass-market segment and up to 65-70 million VND/m² for premium sub-divisions (park view, high floors), equivalent to approximately 2.2-2.6 billion VND/unit for smaller types. This is a summary reference price from the secondary market, fluctuating by sub-division, floor, and specific view – please contact SGS Land for the most accurate updated price quote.",
        "q": "What is the current price (2026) of Vinhomes Grand Park apartments?"
      },
      {
        "a": "Yes. Vinhomes Grand Park has been handed over and has had stable occupancy for many years, starting from The Rainbow sub-division (June 2020), with subsequent sub-divisions being completed and handed over through 2024. The project currently has full operational facilities such as Vinschool, Vinmec Hospital, and Vincom Mega Mall.",
        "q": "Are there residents living in Vinhomes Grand Park?"
      },
      {
        "a": "According to the developer, Vinhomes Grand Park is about 25 minutes from the Thu Thiem financial center, about 30 minutes from the HCMC center, and about 55 minutes from Tan Son Nhat International Airport, thanks to connections with Ring Road 3 and Metro Line 1 (Ben Thanh - Suoi Tien) passing through the vicinity.",
        "q": "How far is Vinhomes Grand Park from the center of Ho Chi Minh City?"
      }
    ],
    "heroImageAlt": "Vinhomes Grand Park mega-city with a 36-hectare central park in Long Binh Ward, Thu Duc City",
    "heroMeta": "Developer Vingroup | 271ha | Tang Nhon Phu & Long Binh Wards, Ho Chi Minh City (formerly District 9)",
    "heroSub": "Updates on sub-division master plans (The Beverly, Glory Heights, The Origami, The Manhattan...), secondary selling prices, and the latest 2026 legal status from SGS Land.",
    "locationIntro": "Vinhomes Grand Park is located on Nguyen Xien Street, currently in the two wards of Tang Nhon Phu and Long Binh, Ho Chi Minh City (formerly District 9, Thu Duc City before the July 1, 2025, administrative merger). This location is conveniently connected to Ring Road 3, the HCMC - Long Thanh - Dau Giay Expressway, and Metro Line 1 (Ben Thanh - Suoi Tien), approximately 25 minutes from the Thu Thiem financial center and 30 minutes from the HCMC center.",
    "navLinks": [
      {
        "href": "#tong-quan",
        "label": "Overview"
      },
      {
        "href": "#vi-tri",
        "label": "Location"
      },
      {
        "href": "#tien-ich",
        "label": "Amenities"
      },
      {
        "href": "#bang-gia",
        "label": "Price List"
      },
      {
        "href": "#faq",
        "label": "FAQ"
      },
      {
        "href": "#lien-he",
        "label": "Contact"
      }
    ],
    "overviewParas": [
      "Vinhomes Grand Park is a 271-hectare mega-city developed by Vingroup, located on Nguyen Xien Street, currently spanning the two wards of Tang Nhon Phu and Long Binh, Ho Chi Minh City (formerly District 9 area, Thu Duc City prior to the July 1, 2025, administrative merger). The project broke ground in 2017 with a construction density of approximately 25% and is one of the urban areas with the largest park scale in the region, featuring a 36-hectare central park.",
      "Vinhomes Grand Park is planned into 8 main sub-divisions including The Beverly, Glory Heights, The Beverly Solari, The Opus One, The Origami, The Rainbow, The Manhattan, and The Manhattan Glory, with a total of 71 apartment towers ranging from 25 to 30 floors, alongside low-rise products (townhouses, villas). The total project scale is announced to be approximately 44,000 units. The Rainbow sub-division began handover in June 2020, with the remaining sub-divisions completed and handed over in subsequent years through 2024.",
      "All handed-over sub-divisions of Vinhomes Grand Park have been issued long-term pink books for domestic buyers (foreigners are entitled to a maximum 50-year ownership as per regulations). Regarding infrastructure, the project provides convenient connections to the Thu Thiem financial center (approx. 25 minutes), Ho Chi Minh City center (approx. 30 minutes), and Tan Son Nhat Airport (approx. 55 minutes), while being located near Metro Line 1 (Ben Thanh - Suoi Tien) and the Ring Road 3."
    ],
    "stats": [
      {
        "lbl": "Total Area",
        "num": "271ha"
      },
      {
        "lbl": "Central Park",
        "num": "36ha"
      },
      {
        "lbl": "Main Sub-divisions",
        "num": "8"
      },
      {
        "lbl": "Apartments & low-rise products",
        "num": "~44.000"
      },
      {
        "lbl": "Apartment towers (25-30 floors)",
        "num": "71"
      },
      {
        "lbl": "Long-term pink book",
        "num": "100%"
      }
    ]
  },
  "vinhomes-central-park": {
    "desc": "Vinhomes Central Park is a riverside mixed-use urban area along the Saigon River in Binh Thanh, adjacent to the Landmark 81 building; it has been handed over and fully titled (pink books issued). Updated secondary pricing and legal status for 2026.",
    "entityTable": [
      {
        "k": "Project name",
        "v": "Vinhomes Central Park"
      },
      {
        "k": "Developer",
        "v": "Vingroup Corporation (Vinhomes brand)"
      },
      {
        "k": "Location",
        "v": "208 Nguyen Huu Canh, Binh Thanh Ward, HCMC (along the Saigon River, next to Landmark 81)"
      },
      {
        "k": "GPS Coordinates",
        "v": "10.7947° N, 106.7218° E (reference)"
      },
      {
        "k": "Scale",
        "v": "~43.9ha, including a 14ha riverside central park"
      },
      {
        "k": "Number of sub-zones",
        "v": "~10 sub-zones: Park 1-8, Landmark Plus, The Landmark (luxury apartments at the base of Landmark 81)"
      },
      {
        "k": "Total units",
        "v": "Per aggregate sources: approximately 10,000-12,000 apartments (reference data, project fully handed over)"
      },
      {
        "k": "Legal status",
        "v": "Pink books issued for all handed-over phases"
      },
      {
        "k": "Connectivity infrastructure",
        "v": "Saigon Bridge, Nguyen Huu Canh - Dien Bien Phu road, approximately 3km from central District 1"
      },
      {
        "k": "Consultation channel",
        "v": "0971 132 378 (SGS LAND – providing reference information)"
      }
    ],
    "eyebrow": "Riverside urban area next to Landmark 81",
    "faq": [
      {
        "a": "Vinhomes Central Park is a ~43.9ha mixed-use urban area along the Saigon River developed by Vingroup, located at 208 Nguyen Huu Canh, Binh Thanh, HCMC, right next to the Landmark 81 building. The project has been fully completed and handed over for several years, currently serving as a stable high-end residential area near the center of District 1.",
        "q": "What is Vinhomes Central Park and where is it located?"
      },
      {
        "a": "The project consists of approximately 10 main sub-zones: Park 1 through Park 8, Landmark Plus, and The Landmark (luxury apartments at the base of Landmark 81). According to aggregate sources, the total number of apartments across the project is approximately 10,000-12,000 units – this is reference data as the project was handed over long ago and there are no new official announcements from the developer.",
        "q": "How many sub-zones and apartments are in Vinhomes Central Park?"
      },
      {
        "a": "Yes. All handed-over phases of Vinhomes Central Park have been issued pink books (Certificates of land use rights and ownership of houses) to residents, allowing for buying, selling, transferring, and bank mortgaging just like any other legally completed property.",
        "q": "Has Vinhomes Central Park received pink books?"
      },
      {
        "a": "Because the project has been handed over and is no longer undergoing primary sales, the current price is primarily a secondary market price, fluctuating based on the sub-zone, floor, view (river view/park view/internal view), and interior condition. This is a reference price that changes constantly with the market and is not an official price list – customers should contact SGS Land for real-time transaction prices for specific units before deciding.",
        "q": "What is the approximate price of a Vinhomes Central Park apartment currently (2026)?"
      },
      {
        "a": "Yes, it is one of the most stable and densely populated urban areas among Vinhomes projects in central HCMC, having been in stable operation since 2017-2018 with complete schools (Vinschool), hospitals (Vinmec Central Park), commercial centers (Vincom Center Landmark 81), and internal services.",
        "q": "Is Vinhomes Central Park densely populated?"
      },
      {
        "a": "Vinhomes Central Park is approximately 3km from central District 1, taking about 10-15 minutes by car depending on the time of day via the Saigon Bridge or the Nguyen Huu Canh - Dien Bien Phu route.",
        "q": "How far is Vinhomes Central Park from central District 1?"
      }
    ],
    "heroImageAlt": "Vinhomes Central Park urban area along the Saigon River next to Landmark 81 building, Binh Thanh, HCMC",
    "heroMeta": "Developer Vingroup/Vinhomes | ~43.9ha | Nguyen Huu Canh Street, Binh Thanh, HCMC",
    "heroSub": "The project is complete, fully handed over, and titled for several years – updated secondary prices, legal status, and latest leasing policies from SGS Land.",
    "locationIntro": "Vinhomes Central Park is situated along the Saigon River on Nguyen Huu Canh Street, Binh Thanh, right next to the Landmark 81 building – the tallest structure in Vietnam. This location is only about 3km from central District 1, connecting directly via the Saigon Bridge and the Dien Bien Phu - Nguyen Huu Canh axis, offering convenient access to the financial and commercial center, and the former Thao Dien, District 2 area.",
    "navLinks": [
      {
        "href": "#tong-quan",
        "label": "Overview"
      },
      {
        "href": "#vi-tri",
        "label": "Location"
      },
      {
        "href": "#tien-ich",
        "label": "Amenities"
      },
      {
        "href": "#bang-gia",
        "label": "Price list"
      },
      {
        "href": "#faq",
        "label": "FAQ"
      },
      {
        "href": "#lien-he",
        "label": "Contact"
      }
    ],
    "overviewParas": [
      "Vinhomes Central Park is a riverside mixed-use urban area along the Saigon River spanning approximately 43.9 hectares, developed by Vingroup Corporation. It is located at 208 Nguyen Huu Canh, Binh Thanh Ward (the area also known by the former name Thanh My Tay), Binh Thanh, HCMC. The project began construction in 2015, handed over its first phases between 2017-2018, and is now fully complete, standing as one of the most stable and long-established high-end urban areas in central HCMC.",
      "The project consists of approximately 10 main sub-zones named Park 1 through Park 8, Landmark Plus, and the luxury apartment cluster The Landmark at the base of Landmark 81 (the tallest building in Vietnam, 461m, 81 floors, developed synchronously by Vinhomes within the complex). The total number of apartments across the project is estimated by aggregate sources at approximately 10,000-12,000 units, alongside the Vincom Center Landmark 81 commercial podium and various internal amenities. Since it has been handed over and occupied for a long time, the market for Vinhomes Central Park is currently primarily secondary (resale, leasing) rather than primary sales from the developer.",
      "All completed phases of Vinhomes Central Park have been issued certificates of ownership (pink books) to residents, which is a major distinction compared to projects currently under construction, as buyers can transfer ownership and mortgage the property with banks immediately. The project is located near District 1 (approximately 3km via Saigon Bridge or the Nguyen Huu Canh - Dien Bien Phu route), making it convenient to travel to the city's administrative and financial center."
    ],
    "stats": [
      {
        "lbl": "Total area",
        "num": "~43,9ha"
      },
      {
        "lbl": "Central park",
        "num": "14ha"
      },
      {
        "lbl": "Sub-zones (Park 1-8, Landmark...)",
        "num": "10+"
      },
      {
        "lbl": "Handed-over apartments",
        "num": "10.000+"
      },
      {
        "lbl": "Pink books issued",
        "num": "100%"
      },
      {
        "lbl": "To central District 1",
        "num": "~3km"
      }
    ]
  },
  "diamond-sky-van-phuc-city": {
    "desc": "Diamond Sky is a high-rise apartment subdivision within the 198ha, three-sided riverfront Van Phuc City urban area in Thu Duc City, developed by Van Phuc Group. Price and legal status updated for 2026.",
    "entityTable": [
      {
        "k": "Project name",
        "v": "Diamond Sky (part of Van Phuc City urban area)"
      },
      {
        "k": "Developer",
        "v": "Van Phuc Group"
      },
      {
        "k": "Location",
        "v": "Van Phuc City urban area, Hiep Binh Phuoc Ward, Thu Duc City, HCMC"
      },
      {
        "k": "GPS Coordinates",
        "v": "10.8386° N, 106.7134° E (reference, Van Phuc City area)"
      },
      {
        "k": "Urban area scale",
        "v": "~198ha, surrounded by the Saigon River on three sides"
      },
      {
        "k": "Type",
        "v": "High-rise apartments (Diamond Sky); the urban area also contains villas, townhouses, and shophouses that have been handed over"
      },
      {
        "k": "Infrastructure connectivity",
        "v": "National Highway 13, Binh Loi Bridge, Pham Van Dong route, approx. 12km from District 1 center"
      },
      {
        "k": "Legal status",
        "v": "Must be verified specifically for each building/phase at the time of transaction"
      },
      {
        "k": "Consulting channel",
        "v": "0971 132 378 (SGS LAND – provides reference information)"
      }
    ],
    "eyebrow": "Luxury high-rise apartments by the Saigon River",
    "faq": [
      {
        "a": "Diamond Sky is a high-rise apartment subdivision located within Van Phuc City (~198ha, surrounded by the Saigon River on three sides) developed by Van Phuc Group in Hiep Binh Phuoc Ward, Thu Duc City, HCMC.",
        "q": "What is the Diamond Sky project?"
      },
      {
        "a": "Van Phuc City is one of the few urban areas in HCMC with a peninsula position surrounded by the Saigon River on three sides, creating a waterfront landscape advantage for most subdivisions. Many low-rise areas (villas, townhouses, shophouses) in the project have been established and inhabited for many years.",
        "q": "What is special about the location of Van Phuc City?"
      },
      {
        "a": "Because Diamond Sky is a high-rise apartment subdivision implemented in the later stages of Van Phuc City, the legal status (pink book) and handover progress need to be verified specifically for each building and at the time of the transaction. Customers should request SGS Land to check the detailed legal documentation before making a decision.",
        "q": "What is the current legal status of Diamond Sky?"
      },
      {
        "a": "According to market records, the reference secondary price for Diamond Sky apartments is from 9.6 billion VND upwards, depending on area, floor, and view; this is a reference price compiled from the market and is not an official price list. Please contact SGS Land (0971 132 378) for updated quotes for specific units.",
        "q": "What is the current price of Diamond Sky apartments?"
      },
      {
        "a": "The Van Phuc City urban area is approximately 12km from the center of District 1, connected via National Highway 13, Binh Loi Bridge, and the Pham Van Dong thoroughfare, with an average travel time of about 20-30 minutes depending on traffic conditions.",
        "q": "How far is Van Phuc City / Diamond Sky from the center of HCMC?"
      }
    ],
    "heroImageAlt": "Diamond Sky apartment tower within the Van Phuc City urban area by the Saigon River, Thu Duc City",
    "heroMeta": "Developer: Van Phuc Group | Van Phuc City Urban Area 198ha | Hiep Binh Phuoc, Thu Duc City, HCMC",
    "heroSub": "High-rise apartment subdivision within the Van Phuc City urban area (198ha, surrounded by the Saigon River on three sides) in Hiep Binh Phuoc, Thu Duc City – updated price list and legal status for 2026 from SGS Land.",
    "locationIntro": "Diamond Sky is located within the Van Phuc City urban area in Hiep Binh Phuoc Ward, Thu Duc City – a peninsula area surrounded by the Saigon River on three sides. From here, it takes approximately 12km to travel to the center of District 1 via National Highway 13, Binh Loi Bridge, and the Pham Van Dong thoroughfare.",
    "navLinks": [
      {
        "href": "#tong-quan",
        "label": "Overview"
      },
      {
        "href": "#vi-tri",
        "label": "Location"
      },
      {
        "href": "#tien-ich",
        "label": "Amenities"
      },
      {
        "href": "#bang-gia",
        "label": "Price list"
      },
      {
        "href": "#faq",
        "label": "FAQ"
      },
      {
        "href": "#lien-he",
        "label": "Contact"
      }
    ],
    "overviewParas": [
      "Diamond Sky is a high-rise apartment subdivision located within Van Phuc City, a self-contained urban area of approximately 198ha developed by Van Phuc Group, located in Hiep Binh Phuoc Ward, Thu Duc City, HCMC. A signature feature of Van Phuc City is its peninsula position surrounded by the Saigon River on three sides, providing waterfront views for most of the project's subdivisions.",
      "Besides Diamond Sky, Van Phuc City includes many low-rise subdivisions (villas, townhouses, shophouses) that have been established and inhabited for several years, along with on-site amenities such as schools, hospitals, commercial centers, Van Phuc Square, and the Van Phuc Amphitheater. Diamond Sky is one of the high-rise apartment projects developed in the later stages of the urban area.",
      "Regarding traffic connectivity, Van Phuc City is located near National Highway 13, Binh Loi Bridge, and the Pham Van Dong thoroughfare, approximately 12km from the center of District 1. The legal status and specific handover progress of Diamond Sky should be verified for each phase/tower at the time of the transaction, as this is a high-rise subdivision implemented after the project's low-rise sections."
    ],
    "stats": [
      {
        "lbl": "Van Phuc City Urban Area scale",
        "num": "198ha"
      },
      {
        "lbl": "Surrounded by the Saigon River",
        "num": "3 sides of river"
      },
      {
        "lbl": "Developer",
        "num": "Van Phuc Group"
      },
      {
        "lbl": "Reference secondary price (2026)",
        "num": "9.6 billion+"
      },
      {
        "lbl": "To District 1 center",
        "num": "~12km"
      }
    ]
  }
};
