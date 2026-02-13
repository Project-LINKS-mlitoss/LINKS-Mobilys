# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#import and model access

import re
import unicodedata
from collections import Counter
from ..models import RouteKeywordMap, RouteKeywords, Routes
import uuid
import random

#Text cleaning and tokenizing

def clean_text(text): #importing raw text
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", str(text)) #normalize text (eg: full-width to half-width, removing unwanted characters)
    return re.sub(r"[^\w一-龯ぁ-んァ-ンー]", "", text) #return clean japanese string

def tokenize_japanese(text):
    return re.findall(r"[一-龯ぁ-んァ-ンー]+", text) #extract only japanese word tokens and return list of tokens

def random_hex_color():
    return "%06x" % random.randint(0, 0xFFFFFF)


#Main processing function

def process_gtfs_df(scenario): #Processes all routes for a scenario and assign keywords to each route
    
    
    #STEP-1: Define Keywords and Ignore List
    
    concept_keywords = { #Predefined categories for matching routes
        "病院": {"病院", "市民病院"},
        "大学": {"大学", "短大"},
        "高校": {"高校", "高専"},
        "空港": {"空港"},
        "駅": {"駅", "鉄道", "新幹線"},
        "フィーダー": {"フィーダー", "フィーダーバス"},
        "シャトル": {"シャトル", "シャトルバス"}
    }
    all_concept_tokens = set(token for tokens in concept_keywords.values() for token in tokens) #Flattening all concept tokens
    ignored_words = {"線", "号線", "行き", "方面", "経由", "バス", "シャトル"} #Common but not useful words
    
    
    #STEP-2: Fetch and Process Route Data
    
    routes_qs = Routes.objects.filter(scenario=scenario) #Get all routes from DB for a particular scenario
    all_tokens = [] #Used for frequency analysis
    route_info  = [] #Stores token and short name data for each route
    
    for route in routes_qs: #For each route
        full_name = f"{route.route_short_name or ''}{route.route_long_name or ''}" #Combine short and long name
        cleaned = clean_text(full_name) #Clean name
        tokens = tokenize_japanese(cleaned) #Tokenize cleaned name
        all_tokens.extend([t for t in tokens if t not in ignored_words]) #Count useful tokens
        
        route_info.append({ #Store route, short name, token for processing
            "route": route,
            "short_name": route.route_short_name or "",
            "tokens": tokens
        })
    

    #STEP-3: Frequency and Pattern Analysis
    
    token_freq = Counter(all_tokens) #Count frequency of each token across all routes
    
    non_concept_tokens = [t for t in token_freq if t not in all_concept_tokens and t not in ignored_words] #Exclude concept + ignored tokens to isolate fallback keyword tokens
    selected_fallback_keywords = sorted(non_concept_tokens, key = lambda t: (-token_freq[t], -len(t)))[:100] #Sorting tokens by: ascending frequency, descending length and taking top 100
    
    
    #STEP-4: Frequent Short Name Analysis
    
    short_names = [r["short_name"] for r in route_info if r["short_name"]] #Go through all route short names and collect them if not empty
    patterned_names = [s for s in short_names if re.match(r".*(線|ルート|循環)$", s)] #Check all short names ending with 線, ルート, or 循環
    short_name_freq = Counter(patterned_names) #if they occur more than once, consider good option for fallback keywords
    frequent_short_name_keywords = {k for k, v in short_name_freq.items() if v > 1}
    
    
    #STEP-5: Assign Keywords
    
    for r in route_info:  #For each route, try to match keywords based on priority
        tokens = r["tokens"]
        short_name = r["short_name"]
        matched_keyword = ""
        
        #Priority 1: Concept keywords
        for concept_set in concept_keywords.values():
            for token in tokens:
                if token in concept_set:
                    matched_keyword = token
                    break
            if matched_keyword:
                break
            
        #Priority 2: Fallback keywords
        if not matched_keyword:
            valid_tokens = [t for t in tokens if t in selected_fallback_keywords]
            if valid_tokens:
                valid_tokens.sort(key = lambda t: (-token_freq[t], -len(t)))
                matched_keyword = valid_tokens[0]
        
        #Priority 3: Frequent short names
        if not matched_keyword and short_name in frequent_short_name_keywords:
            matched_keyword = short_name
            
        #Skip if no keyword found
        if not matched_keyword:
            continue
        
        #STEP-6: Save to database

        # generate a color for the keyword
        color = random_hex_color()

        keyword_obj, _ = RouteKeywords.objects.get_or_create(
            keyword=matched_keyword,
            scenario=scenario,
            defaults={
                "id": uuid.uuid4(),
                "keyword_color": color
            }
        )

        RouteKeywordMap.objects.get_or_create(
            scenario=scenario,
            route_id=r["route"].route_id,
            keyword=keyword_obj,
            defaults={"can_automatically_update": True}
        )