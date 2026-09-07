package de.zoll.wartungsfenster.util;

import jakarta.json.bind.Jsonb;
import jakarta.json.bind.JsonbBuilder;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Persistiert eine einfache String-zu-String-Map (z. B. Spalten-Hintergrundfarben)
 * als JSON-Text in einer MySQL-JSON-Spalte. Nutzt JSON-B (Yasson), das als Teil
 * der vollen Jakarta-EE-Plattform bereits auf JBoss EAP 8.1 mitgeliefert wird -
 * es ist also keine zusätzliche Abhängigkeit im pom.xml nötig.
 */
@Converter
public class ColorMapConverter implements AttributeConverter<Map<String, String>, String> {

    private static final Jsonb JSONB = JsonbBuilder.create();

    @Override
    public String convertToDatabaseColumn(Map<String, String> attribute) {
        return JSONB.toJson(attribute == null ? Map.of() : attribute);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new LinkedHashMap<>();
        }
        return new LinkedHashMap<>(JSONB.fromJson(dbData, Map.class));
    }
}
