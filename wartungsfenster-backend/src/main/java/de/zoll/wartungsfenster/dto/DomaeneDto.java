package de.zoll.wartungsfenster.dto;

public class DomaeneDto {
    public Long id;
    public String name;

    public DomaeneDto() {}
    public DomaeneDto(Long id, String name) {
        this.id = id;
        this.name = name;
    }
}
